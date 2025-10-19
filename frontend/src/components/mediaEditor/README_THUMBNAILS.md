# Система миниатюр абзацев

## Обзор

Реализована система для автоматической генерации миниатюр абзацев на основе их координат в изображении. Система отслеживает изменения координат абзацев и автоматически обновляет миниатюры.

## Компоненты

### 1. `thumbnailGenerator.ts`
Основные функции для генерации миниатюр:

- `generateParagraphThumbnail()` - генерирует миниатюру для конкретного абзаца
- `updateAllParagraphThumbnails()` - обновляет миниатюры для всех абзацев
- `cacheThumbnailsInFile()` - кэширует миниатюры в структуре файла
- `getCachedThumbnail()` - получает миниатюру из кэша

### 2. `useParagraphThumbnails.ts`
React-хук для управления миниатюрами:

- Отслеживает изменения координат абзацев
- Автоматически генерирует миниатюры при изменениях
- Предоставляет API для получения миниатюр
- Кэширует результаты для производительности

### 3. Интеграция в компоненты

#### `MainCanvas.tsx`
- Передает ссылку на элемент изображения в хук миниатюр
- Отслеживает изменения размера контейнера

#### `TextTab.tsx`
- Отображает миниатюры в списке абзацев
- Загружает миниатюры асинхронно
- Показывает миниатюры рядом с текстом абзаца

## Как это работает

1. **Отслеживание изменений**: Хук `useParagraphThumbnails` отслеживает изменения в координатах абзацев через `createEffect`

2. **Генерация миниатюр**: При изменении координат система:
   - Получает оригинальные координаты из OCR данных
   - Масштабирует координаты к размеру изображения
   - Вырезает соответствующую область из изображения
   - Создает миниатюру размером до 200x200 пикселей

3. **Кэширование**: Миниатюры сохраняются в структуре файла (`UploadedFile.paragraphThumbnails`)

4. **Отображение**: В списке абзацев показываются миниатюры размером 60x60 пикселей

## Координаты и масштабирование

Система учитывает **реальные рендерящиеся размеры изображения** в контейнере:

1. **Масштабирование изображения**: Использует ту же логику, что и `imageCanvas.tsx`
2. **Преобразование координат**: Переводит координаты слоя в координаты оригинального изображения
3. **Учет offset**: Учитывает смещение изображения в контейнере

**Алгоритм преобразования**:
```typescript
// 1. Вычисляем размеры изображения в контейнере (как в imageCanvas.tsx)
const imageAspectRatio = imageWidth / imageHeight;
const containerAspectRatio = containerWidth / containerHeight;
// ... вычисляем displayWidth, displayHeight, offsetX, offsetY

// 2. Масштаб от контейнера к оригинальному изображению
const scaleX = imageWidth / displayWidth;
const scaleY = imageHeight / displayHeight;

// 3. Преобразуем координаты слоя в координаты изображения
const imageLeft = (layerLeft - offsetX) * scaleX;
const imageTop = (layerTop - offsetY) * scaleY;
const imageWidth_scaled = layerWidth * scaleX;
const imageHeight_scaled = layerHeight * scaleY;
```

**Важно**: Система правильно учитывает масштабирование изображения в контейнере и преобразует координаты слоя в координаты оригинального изображения для точного вырезания.

## Производительность

- Миниатюры генерируются асинхронно
- Используется debounce (500мс) для избежания частых перегенераций
- Кэширование предотвращает повторную генерацию
- Миниатюры сжимаются до JPEG с качеством 0.8

## Стили

Добавлены CSS классы:
- `.media-editor__ocr-paragraph-content` - контейнер для миниатюры и текста
- `.media-editor__ocr-paragraph-thumbnail` - стили для миниатюры
- `.media-editor__ocr-paragraph-text` - обновленные стили для текста

## Использование

```typescript
// В компоненте
const paragraphThumbnails = useParagraphThumbnails();

// Получить миниатюру
const thumbnail = await paragraphThumbnails.getThumbnail(blockIndex);

// Генерировать все миниатюры
await paragraphThumbnails.generateThumbnails();
```

## Типы

```typescript
interface ParagraphThumbnail {
  blockIndex: number;
  thumbnail: string; // base64 data URL
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lastUpdated: number;
}
```
