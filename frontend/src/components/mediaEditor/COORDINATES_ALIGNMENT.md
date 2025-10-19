# Выравнивание координат с media-editor__resizable-container

## Проблема
Миниатюры должны показывать точно те же области, что видны в `media-editor__resizable-container`.

## Решение
Используем точно такие же формулы вычисления координат, как в `ResizableContainer`.

## Сравнение координат

### media-editor__resizable-container (из ResizableContainer)
```typescript
style={{
  'left': processedLayer().position[0] + store.diff[0] + 'px',
  'top': processedLayer().position[1] + store.diff[1] + 'px',
  'width': props.layer.width ? props.layer.width * processedLayer().scale + 'px' : 'auto',
  'height': props.layer.height ? props.layer.height * processedLayer().scale + 'px' : 'auto',
}}
```

### thumbnailGenerator.ts (исправлено)
```typescript
const left = layer.position[0];           // ✅ Точно как в container
const top = layer.position[1];             // ✅ Точно как в container  
const width = (layer.width || 0) * layer.scale;   // ✅ Точно как в container
const height = (layer.height || 0) * layer.scale; // ✅ Точно как в container
```

## Исключения

### store.diff
- **В ResizableContainer**: `store.diff[0]` и `store.diff[1]` - временное смещение при перетаскивании
- **В thumbnailGenerator**: НЕ используем, так как нужны финальные координаты без временного смещения

### processedLayer()
- **В ResizableContainer**: `processedLayer().scale` = `layer.scale`
- **В thumbnailGenerator**: Используем `layer.scale` напрямую

## Результат

```
┌─────────────────────────────────────────────────────────────┐
│                    Изображение                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        media-editor__resizable-container          │   │
│  │        left: 100px, top: 50px                     │   │
│  │        width: 200px, height: 100px                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Миниатюра                             │   │
│  │        Вырезает: x=100, y=50                       │   │
│  │        Размер: 200x100                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Проверка соответствия

1. **Позиция**: `layer.position[0]`, `layer.position[1]` ✅
2. **Размер**: `layer.width * layer.scale`, `layer.height * layer.scale` ✅
3. **Масштаб**: Учитывается в размерах ✅
4. **Временное смещение**: Игнорируется (нужны финальные координаты) ✅

## Отслеживание изменений

```typescript
// Сравниваем с масштабированными размерами
const scaledWidth = (layer.width || 0) * layer.scale;
const scaledHeight = (layer.height || 0) * layer.scale;

if (cached.coordinates.x !== layer.position[0] || 
    cached.coordinates.y !== layer.position[1] ||
    cached.coordinates.width !== scaledWidth ||
    cached.coordinates.height !== scaledHeight) {
  hasChanges = true;
}
```

Теперь миниатюры будут показывать точно те же области, что видны в интерфейсе!

