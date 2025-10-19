# Рендеринг с object-fit: contain

## Проблема
Нужно рендерить изображение с `width=100%` и `object-fit: contain`, чтобы миниатюра выглядела красиво и пропорционально.

## Решение
Используем алгоритм `object-fit: contain` для правильного масштабирования и центрирования изображения в миниатюре.

## Алгоритм object-fit: contain

### 1. Заливка фона
```typescript
// Сначала заливаем белый фон
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
```

### 2. Вычисление размеров для contain
```typescript
const aspectRatio = imageWidth / imageHeight;
const thumbnailAspectRatio = thumbnailWidth / thumbnailHeight;

if (aspectRatio > thumbnailAspectRatio) {
  // Изображение шире - подгоняем по ширине
  renderWidth = thumbnailWidth;
  renderHeight = thumbnailWidth / aspectRatio;
  renderX = 0;
  renderY = (thumbnailHeight - renderHeight) / 2;
} else {
  // Изображение выше - подгоняем по высоте
  renderHeight = thumbnailHeight;
  renderWidth = thumbnailHeight * aspectRatio;
  renderX = (thumbnailWidth - renderWidth) / 2;
  renderY = 0;
}
```

### 3. Рендеринг с центрированием
```typescript
ctx.drawImage(
  imageElement,
  imageLeft, imageTop, imageWidth, imageHeight, // source coordinates
  renderX, renderY, renderWidth, renderHeight // destination coordinates с центрированием
);
```

## Примеры рендеринга

### Случай 1: Изображение шире миниатюры
```
┌─────────────────────────────────────────────────────────────┐
│                    Миниатюра (200x200)                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Изображение (200x100)                       │   │
│  │        Центрировано по вертикали                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Случай 2: Изображение выше миниатюры
```
┌─────────────────────────────────────────────────────────────┐
│                    Миниатюра (200x200)                     │
│                                                             │
│        ┌─────────────────────────────────────────┐         │
│        │        Изображение (100x200)           │         │
│        │        Центрировано по горизонтали     │         │
│        └─────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Преимущества

1. **Пропорциональность**: Изображение не искажается
2. **Центрирование**: Изображение всегда по центру
3. **Красивый вид**: Белый фон вокруг изображения
4. **Стандартность**: Поведение как у CSS `object-fit: contain`

## Сравнение с CSS

### CSS:
```css
.thumbnail {
  width: 200px;
  height: 200px;
  object-fit: contain;
  background: white;
}
```

### Canvas (наша реализация):
```typescript
// Заливаем белый фон
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);

// Вычисляем размеры для contain
const aspectRatio = imageWidth / imageHeight;
const thumbnailAspectRatio = thumbnailWidth / thumbnailHeight;

// Рендерим с центрированием
ctx.drawImage(imageElement, renderX, renderY, renderWidth, renderHeight);
```

## Результат

Миниатюры теперь выглядят профессионально:
- ✅ Пропорциональное масштабирование
- ✅ Центрирование изображения
- ✅ Белый фон вокруг изображения
- ✅ Поведение как у CSS `object-fit: contain`

