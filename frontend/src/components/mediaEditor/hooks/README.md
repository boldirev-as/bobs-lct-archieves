# Media Editor Hooks

## File-specific hooks для работы со Swiper

### `useFileByIndex(index)`
Получает файл по индексу в массиве `uploadedFiles`.

```typescript
const fileIndex = () => 0; // или props.fileIndex
const file = useFileByIndex(fileIndex);
```

### `useFileById(fileId)`
Получает файл по ID.

```typescript
const fileId = () => "file-123"; // или props.fileId
const file = useFileById(fileId);
```

### `useIsFileActive(file)`
Проверяет, является ли файл активным (выбранным как `targetFile`).

```typescript
const file = useFileByIndex(0);
const isActive = useIsFileActive(file);

// В JSX
{isActive() && <ActiveIndicator />}
```

### `useFileIndex(file)`
Получает индекс файла в массиве `uploadedFiles`.

```typescript
const file = useFileById("file-123");
const index = useFileIndex(file);
```

## Использование в Swiper

В `FilesSwiper` каждый слайд получает `fileIndex`:

```typescript
<For each={mediaState.uploadedFiles}>
  {(file, index) => (
    <swiper-slide>
      <MainCanvas fileId={file.id} fileIndex={index()} />
    </swiper-slide>
  )}
</For>
```

В `MainCanvas` используются хуки для получения правильного файла:

```typescript
const fileByIndex = props.fileIndex !== undefined 
  ? useFileByIndex(props.fileIndex) 
  : () => undefined;
  
const currentFile = createMemo(() => {
  const byIndex = fileByIndex();
  if (byIndex) return byIndex;
  // fallback...
});

const isActive = useIsFileActive(currentFile);
```

## Преимущества

1. **Изоляция данных**: Каждый слайд работает со своим файлом
2. **Независимость**: Изменения в одном файле не влияют на другие
3. **Производительность**: Реактивность работает только для нужных данных
4. **Надежность**: Приоритет index > id > current обеспечивает корректность

