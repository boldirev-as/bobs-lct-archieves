# infer.py
# -*- coding: utf-8 -*-
import os
import re
import argparse
from typing import Optional, List

import torch
from PIL import Image
from tqdm import tqdm

from transformers import AutoProcessor, AutoModelForImageTextToText, BitsAndBytesConfig
from peft import PeftModel

DEFAULT_INSTRUCTION = "Расшифруй текст на изображении."
GEMMA_ASSISTANT_TAG_TEXT = "<start_of_turn>model"  # для совместимости при ручной сборке, если вдруг понадобится


def find_latest_checkpoint(dir_path: str) -> Optional[str]:
    """Возвращает путь к последнему outputs/checkpoint-XXXX; если их нет, вернёт сам dir_path (финальный save_model)."""
    if not os.path.isdir(dir_path):
        return None
    ckpts = []
    for name in os.listdir(dir_path):
        m = re.match(r"checkpoint-(\d+)$", name)
        if m:
            ckpts.append((int(m.group(1)), os.path.join(dir_path, name)))
    if ckpts:
        ckpts.sort(key=lambda x: x[0])
        return ckpts[-1][1]
    return dir_path  # может быть финальный адаптер прямо в outputs/


def load_model_and_processor(model_path: str, lora_path: Optional[str], merge_lora: bool = False):
    """Загружает базовую модель + LoRA. При merge_lora=True сливает адаптер (быстрее инференс)."""
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_quant_storage=torch.bfloat16,
    )

    # пробуем включить flash-attn-2
    attn_impl = "flash_attention_2"
    try:
        import flash_attn  # noqa: F401
    except Exception:
        attn_impl = None

    print("-> Загружаю базовую модель...")
    model = AutoModelForImageTextToText.from_pretrained(
        model_path,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        attn_implementation=attn_impl,
        local_files_only=True,
    )
    model.config.use_cache = True  # на инференсе кэш включён

    print("-> Загружаю процессор...")
    processor = AutoProcessor.from_pretrained(model_path, local_files_only=True)
    try:
        if hasattr(processor, "image_processor") and hasattr(processor.image_processor, "use_fast"):
            processor.image_processor.use_fast = True
    except Exception:
        pass

    if lora_path:
        print(f"-> Подключаю LoRA: {lora_path}")
        model = PeftModel.from_pretrained(model, lora_path)
        if merge_lora:
            print("-> Мёрджу LoRA в базовую модель...")
            model = model.merge_and_unload()

    return model, processor


def build_chat_input(processor, image: Image.Image, instruction: str) -> dict:
    """
    Собирает input через chat template, как в тренинге:
    user: текст-инструкция + <image>
    assistant: (пусто, только подсказка для генерации)
    """
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": instruction},
                {"type": "image", "image": image},
            ],
        },
        # add_generation_prompt=True сам добавит начало ответа ассистента
    ]

    # Текстовую часть даём из apply_chat_template, а изображения — отдельно в processor(...)
    chat_text = processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,  # генерируем продолжение от ассистента
    )

    inputs = processor(
        text=[chat_text],
        images=[[image.convert("RGB")]],  # список сообщений с одной картинкой
        return_tensors="pt",
        padding=True,
    )
    return inputs


@torch.inference_mode()
def predict_one(model, processor, image, instruction: str,
                max_new_tokens: int = 128, temperature: float = 0.2, top_p: float = 0.9) -> str:
    # image = Image.open(image_path).convert("RGB")
    batch = build_chat_input(processor, image, instruction)

    device = next(model.parameters()).device
    batch = {k: v.to(device) for k, v in batch.items()}

    gen = model.generate(
        **batch,
        max_new_tokens=max_new_tokens,
        do_sample=(temperature is not None and temperature > 0),
        temperature=temperature if temperature and temperature > 0 else None,
        top_p=top_p,
        eos_token_id=processor.tokenizer.eos_token_id,
        pad_token_id=processor.tokenizer.pad_token_id,
    )
    text = processor.batch_decode(gen, skip_special_tokens=True)[0]
    return text.strip()


def list_images(folder: str) -> List[str]:
    exts = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}
    paths = []
    for root, _, files in os.walk(folder):
        for f in files:
            if os.path.splitext(f.lower())[1] in exts:
                paths.append(os.path.join(root, f))
    return sorted(paths)


def main():
    parser = argparse.ArgumentParser(description="Inference Gemma-3-4B-IT + LoRA (OCR)")
    parser.add_argument("--model_path", type=str, default="./models/gemma-3-4b-it",
                        help="Локальный путь к базовой модели")
    parser.add_argument("--outputs_dir", type=str, default="./outputs",
                        help="Где лежат checkpoint-* или финальный адаптер")
    parser.add_argument("--lora_path", type=str, default=None,
                        help="Явный путь к адаптеру (перебивает --outputs_dir)")
    parser.add_argument("--merge_lora", action="store_true",
                        help="Слить LoRA в базовую модель перед инференсом")
    parser.add_argument("--image", type=str, default=None,
                        help="Путь к одному изображению")
    parser.add_argument("--images_dir", type=str, default=None,
                        help="Папка с изображениями для батч-инференса")
    parser.add_argument("--instruction", type=str, default=DEFAULT_INSTRUCTION,
                        help="Инструкция (промпт) для модели")
    parser.add_argument("--max_new_tokens", type=int, default=128)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--top_p", type=float, default=0.9)
    args = parser.parse_args()

    # определяем путь к LoRA
    lora_path = args.lora_path if args.lora_path else find_latest_checkpoint(args.outputs_dir)
    if lora_path is None:
        print("! Не найден адаптер. Запустим базовую модель без LoRA.")

    model, processor = load_model_and_processor(
        model_path=args.model_path,
        lora_path=lora_path,
        merge_lora=args.merge_lora,
    )

    if args.image:
        out = predict_one(
            model, processor, args.image, args.instruction,
            args.max_new_tokens, args.temperature, args.top_p
        )
        print(f"\n[{os.path.basename(args.image)}]\n{out}\n")

    if args.images_dir:
        paths = list_images(args.images_dir)
        if not paths:
            print(f"В папке {args.images_dir} не найдено изображений.")
        else:
            print(f"Найдено {len(paths)} изображений. Запускаю инференс...")
            for p in tqdm(paths):
                out = predict_one(
                    model, processor, p, args.instruction,
                    args.max_new_tokens, args.temperature, args.top_p
                )
                rel = os.path.relpath(p, args.images_dir)
                print(f"\n[{rel}]\n{out}\n")


if __name__ == "__main__":
    print("Aboba" if torch.cuda.is_available() else "Ben")
    main()
