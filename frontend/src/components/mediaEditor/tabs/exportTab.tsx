import {onMount, Accessor, JSX, createEffect, untrack, Show, createMemo, createSignal, For, onCleanup} from 'solid-js';


import ripple from '../../ripple'; ripple;
import {IconTsx} from '../../iconTsx';
import Space from '../../space';

import {createStoredColor} from '../createStoredColor';
import {useMediaEditorContext} from '../context';
import ColorPicker from '../colorPicker';
import LargeButton from '../largeButton';
import RangeInput from '../rangeInput';
import DoubleRangeSlider from '../doubleRangeSlider';
import {fontInfoMap} from '../utils';
import {FontKey, EntityType} from '../types';
import TabContent from './tabContent';
import { ScrollableYTsx } from '../../chat/topbarSearch';
import EditLineTab from './editLineTab';
import BottomButton from '../bottomButton';

export default function ExportTab() {
  const {editorState, actions} = useMediaEditorContext();
  
  // Tab mode state for table/edit/column switching
  const [currentMode, setCurrentMode] = createSignal<'table' | 'edit' | 'column'>('table');
  const [localCellValue, setLocalCellValue] = createSignal('');
  // Use global selectedColumnIndex from context
  const selectedColumnIndex = () => {
    const index = editorState.selectedColumnIndex || 0;
    return index;
  };
  const setSelectedColumnIndex = (index: number) => {
    actions.setSelectedColumnIndex(index);
  };
  
  // Initialize table if it doesn't exist (column-based structure)
  const initializeTable = () => {
    if (!editorState.targetFile?.table) {
      if (editorState.targetFile) {
        editorState.targetFile.table = [['Название колонки']]; // First column with header
        editorState.targetFile.targetRow = 0;
        editorState.targetFile.targetColumn = 0;
      }
    }
  };
  
  // Get current table data with memoization for reactivity (column-based)
  const getTable = createMemo(() => {
    initializeTable();
    const table = editorState.targetFile?.table;
    return table || [['Название колонки']]; // Array of columns
  });
  
  // Get headers from all columns
  const getHeaders = createMemo(() => {
    const table = getTable();
    return table.map(column => column[0] || ''); // First element of each column is header
  });
  
  // Get current target cell (column-based)
  const getCurrentCell = () => {
    const table = getTable();
    const row = editorState.targetFile?.targetRow || 0;
    const col = editorState.targetFile?.targetColumn || 0;
    return table[col]?.[row] || '';
  };
  
  // Handle cell click to edit
  const handleCellEdit = (row: number, col: number) => {
    if (editorState.targetFile) {
      editorState.targetFile.targetRow = row;
      editorState.targetFile.targetColumn = col;
      setLocalCellValue(getCurrentCell());
      setCurrentMode('edit');
    }
  };
  
  // Handle column tab click to view column
  const handleColumnClick = (colIndex: number) => {
    setSelectedColumnIndex(colIndex);
  };
  
  // Save cell value (column-based)
  const handleSaveCell = () => {
    if (editorState.targetFile) {
      const table = getTable().map(column => [...column]); // Create deep copy of columns
      const row = editorState.targetFile.targetRow || 0;
      const col = editorState.targetFile.targetColumn || 0;
      
      // Ensure column exists
      while (table.length <= col) {
        const newColumnName = `Колонка ${table.length + 1}`;
        table.push([newColumnName]); // New column with just header
      }
      
      // Ensure row exists in column
      while (table[col].length <= row) {
        table[col].push(''); // Add empty cells if needed
      }
      
      table[col][row] = localCellValue();
      
      // Force reactivity by creating new file object
      const updatedFile = { ...editorState.targetFile, table: table };
      actions.setTargetFile(updatedFile);
      
      if (row === 0) {
        setSelectedColumnIndex(col);
      }

      setCurrentMode('table');
    }
  };
  
  // Delete cell (only for non-existing columns or regular cells)
  const handleDeleteCell = () => {
    const row = editorState.targetFile?.targetRow || 0;
    const col = editorState.targetFile?.targetColumn || 0;
    
    if (row === 0 && col === 0) return; // Cannot delete main cell
    
    if (editorState.targetFile) {
      const table = [...getTable()]; // Create deep copy
      
      // If editing header row (row 0) and column doesn't exist yet, just cancel creation
      if (row === 0 && col >= table[0].length) {
        // This is a new column being created, just cancel
        setCurrentMode('table');
        return;
      }
      
      // For existing columns in header row, delete entire column
      if (row === 0) {
        handleDeleteColumn(col);
      } else {
        // Otherwise, just clear the cell (column-based)
        const table = getTable().map(column => [...column]); // Deep copy
        if (table[col] && table[col][row] !== undefined) {
          // Remove the cell by splicing it out
          table[col].splice(row, 1);
          // Force reactivity by creating new file object
          const updatedFile = { ...editorState.targetFile, table: table };
          actions.setTargetFile(updatedFile);
        }
      }
      setCurrentMode('table');
    }
  };
  
  // Delete column (except first column)
  const handleDeleteColumn = (colIndex: number) => {
    if (colIndex === 0) return; // Cannot delete first column
    
    if (editorState.targetFile) {
      const table = getTable().map(column => [...column]); // Deep copy
      
      // Remove entire column
      table.splice(colIndex, 1);
      
      // Force reactivity by creating new file object
      const updatedFile = { ...editorState.targetFile, table: table };
      actions.setTargetFile(updatedFile);
      
      // Adjust selected column index if needed
      if (selectedColumnIndex() >= colIndex) {
        setSelectedColumnIndex(Math.max(0, selectedColumnIndex() - 1));
      }
    }
  };
  
  // Add new column (column-based)
  const handleAddColumn = () => {
    if (editorState.targetFile) {
      const table = getTable();
      const newColumnIndex = table.length;
      
      // Don't save to table yet, just open edit mode for the new column header
      editorState.targetFile.targetRow = 0;
      editorState.targetFile.targetColumn = newColumnIndex;
      setLocalCellValue(`Колонка ${newColumnIndex + 1}`);
      setCurrentMode('edit');
    }
  };
  
  const handleDownloadCSV = () => {
    const table = getTable(); // Array of columns
    
    // Find maximum row count across all columns
    const maxRows = Math.max(...table.map(column => column.length));
    
    // Convert column-based to row-based structure for CSV
    const rows: string[][] = [];
    for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
      const row: string[] = [];
      for (let colIndex = 0; colIndex < table.length; colIndex++) {
        row.push(table[colIndex][rowIndex] || '');
      }
      rows.push(row);
    }
    
    const csv = rows.map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editorState.targetFile?.filename || 'table'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleDownloadXLSX = () => {
    const table = getTable(); // Array of columns
    
    // Find maximum row count across all columns
    const maxRows = Math.max(...table.map(column => column.length));
    
    // Convert column-based to row-based structure for XLSX
    const rows: string[][] = [];
    for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
      const row: string[] = [];
      for (let colIndex = 0; colIndex < table.length; colIndex++) {
        row.push(table[colIndex][rowIndex] || '');
      }
      rows.push(row);
    }
    
    // Simple XLSX-like format (TSV for now)
    const tsv = rows.map(row => row.join('\t')).join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editorState.targetFile?.filename || 'table'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TableMode = () => {
    const table = createMemo(() => getTable());
    console.log(table());
    let isFirstRender = true;
    
    createEffect(() => {
      const activeIndex = selectedColumnIndex();
      const activeTab = document.querySelector(`[data-tab-index="${activeIndex}"]`);

      if (isFirstRender) {
        isFirstRender = false;
        setTimeout(() => {
          activeTab?.scrollIntoView({ block: 'nearest', inline: 'center' });
        }, 400);
        return;
      }

      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
    
    return (
      <div class="media-editor__tab-content-scrollable-content tabs" style={"overfow: clip"}>
        <div class="folders-tabs-scrollable menu-horizontal-scrollable" style="box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <div class="scrollable scrollable-x">
            <nav class="menu-horizontal-div">
              <For each={getHeaders()}>
                {(cellValue, index) => (
                  <div
                    class={`menu-horizontal-div-item rp ${selectedColumnIndex() === index() ? 'active' : ''}`}
                    data-tab-index={index()}
                    onClick={() => handleColumnClick(index())}
                    use:ripple
                    style="position: relative;"
                  >
                    <span class="menu-horizontal-div-item-span">
                      <span class="text-super" dir="auto">
                        {cellValue || `Колонка ${index() + 1}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellEdit(0, index());
                        }}
                        style="margin-left: 6px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 6px; color: inherit; cursor: pointer; transition: all 0.2s; flex-shrink: 0;"
                      >
                        <IconTsx icon="edit" style="font-size: 18px;" />
                      </button>
                      <Show when={selectedColumnIndex() === index()}>
                        <i style="transform: none;" class="animate"></i>
                      </Show>
                    </span>
                    
                    {/* Fake overlay element above ripple - positioned exactly like original */}
                    <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 1;" class="menu-horizontal-div-item-span">
                      <span style="opacity: 0.7; pointer-events: none;" class="text-super" dir="auto">
                        {cellValue || `Колонка ${index() + 1}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellEdit(0, index());
                        }}
                        style="margin-left: 6px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 6px; color: inherit; cursor: pointer; transition: all 0.2s; flex-shrink: 0; pointer-events: auto; z-index: 2;"
                      >
                        <IconTsx icon="edit" style="font-size: 18px;" />
                      </button>
                    </span>
                  </div>
                )}
              </For>
            </nav>
          </div>
        </div>
        
        {/* Column content under tabs */}
        <TabContent
          currentTab={selectedColumnIndex().toString()}
          onContainer={() => {}}
          onScroll={() => {}}
          tabs={getHeaders().reduce((acc, _, colIndex) => {
            acc[colIndex.toString()] = () => <ColumnContent columnIndex={colIndex} />;
            return acc;
          }, {} as Record<string, () => JSX.Element>)}
        />
      </div>
    );
  };
  
  // Column mode component - shows elements in selected column (column-based)
  const ColumnMode = () => {
    const table = createMemo(() => getTable());
    const columnData = createMemo(() => {
      const selectedColumn = table()[selectedColumnIndex()];
      if (!selectedColumn) return [];
      
      return selectedColumn.slice(1) // Skip header
        .map((value, rowIndex) => ({
          value: value || '',
          rowIndex: rowIndex + 1
        }))
        .filter(item => item.value.trim() !== ''); // Only show non-empty cells
    });
    
    return (
      <ScrollableYTsx>
        <div class="media-editor__ocr-content">
          <div class="media-editor__ocr-entities">
            <Show
              when={columnData().length > 0}
              fallback={
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📁</div>
                  <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Нет элементов в колонке</div>
                </div>
              }
            >
              <For each={columnData()}>
                {(item) => (
                  <div
                    class="media-editor__ocr-paragraph-wrapper"
                    onClick={() => handleCellEdit(item.rowIndex, selectedColumnIndex())}
                  >
                    <div class="media-editor__ocr-paragraph" use:ripple>
                      <div class="media-editor__ocr-paragraph-text">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                          <span style="font-size: 12px; color: var(--secondary-text-color); font-weight: 500;">
                            [{item.rowIndex}, {selectedColumnIndex()}]
                          </span>
                        </div>
                        {item.value || 'Пустая ячейка'}
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </ScrollableYTsx>
    );
  };
  
  // Column content component - shows elements in selected column (column-based)
  const ColumnContent = (props: { columnIndex: number }) => {
    const table = createMemo(() => getTable());
    const columnData = createMemo(() => {
      const column = table()[props.columnIndex];
      if (!column) return [];
      
      return column.slice(1) // Skip header
        .map((value, rowIndex) => ({
          value: value || '',
          rowIndex: rowIndex + 1
        }))
        .filter(item => item.value.trim() !== ''); // Only show non-empty cells
    });
    
    return (
      <ScrollableYTsx>
        <div class="media-editor__ocr-content">
          <div class="media-editor__ocr-entities">
            <Show
              when={columnData().length > 0}
              fallback={
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">📁</div>
                  <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Нет элементов в колонке</div>
                </div>
              }
            >
              <For each={columnData()}>
                {(item) => (
                  <div
                    class="media-editor__ocr-paragraph-wrapper"
                    onClick={() => handleCellEdit(item.rowIndex, props.columnIndex)}
                  >
                    <div class="media-editor__ocr-paragraph" use:ripple>
                      <div class="media-editor__ocr-paragraph-text">
                        {item.value || 'Пустая ячейка'}
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </ScrollableYTsx>
    );
  };
  
  // Edit mode component - shows cell editor
  const EditMode = () => {
    const row = editorState.targetFile?.targetRow || 0;
    const col = editorState.targetFile?.targetColumn || 0;
    const table = createMemo(() => getTable());
    
    // Can delete if: not main cell (0,0) AND (cell has content OR it's a new header column being created)
    const cellExists = table()[col] && table()[col][row] !== undefined && table()[col][row] !== '';
    const isNewHeaderColumn = row === 0 && col >= table().length; // New column being created
    const isExistingHeaderColumn = row === 0 && col > 0 && col < table().length; // Existing column
    const canDelete = !(row === 0 && col === 0) && (cellExists || isNewHeaderColumn || isExistingHeaderColumn);
    
    // Delete button text depends on what we're deleting
    let deleteButtonText = 'Удалить';
    if (row === 0) {
      deleteButtonText = isNewHeaderColumn ? 'Отменить' : 'Удалить колонку';
    }
    
    return (
      <>
        <div style="position: sticky; left: 0; top: -8px; background-color: #212121; z-index: 10" class="media-editor__edit-line-editor-header">
          <button
            class="media-editor__edit-line-back-btn"
            onClick={() => setCurrentMode('table')}
            use:ripple
            title="Назад"
          >
            <IconTsx icon="left" />
          </button>
          <div style="margin-left: 8px" class="media-editor__edit-line-editor-title">
            Редактирование ячейки [{row}, {col}]
          </div>
        </div>
        
        <div class="media-editor__ocr-content">
          <div class="media-editor__edit-line-editor-body">
            <textarea
              class="media-editor__edit-line-editor-textarea"
              value={localCellValue()}
              onInput={(e) => setLocalCellValue(e.target.value)}
              placeholder="Введите значение ячейки"
              style={'margin-bottom: -12px;'}
            />
            
            <div class="media-editor__edit-line-editor-actions">
              <Show when={canDelete && !isNewHeaderColumn}>
                <button
                  class="media-editor__edit-line-editor-btn media-editor__edit-line-editor-btn--delete"
                  onClick={handleDeleteCell}
                  use:ripple
                >
                  {deleteButtonText}
                </button>
              </Show>
            </div>
          </div>
        </div>
        
        <BottomButton
          onClick={handleSaveCell}
          style="bottom: 112px;"
        >
          Сохранить
        </BottomButton>
      </>
    );
  };

  const [savedColor, setSavedColor] = createStoredColor('media-editor-text-color', '#ffffff');

  editorState.currentTextLayerInfo.color = savedColor().value;
  createEffect(() => {
    untrack(() => editorState.currentTextLayerInfo).color = savedColor().value;
  });

  onMount(() => {
    document.querySelectorAll('.media-editor__toggle-button').forEach((element) => {
      ripple(element as HTMLElement);
    });
  });

  return (
    <Show 
      when={editorState.targetFile} 
      fallback={
        <>
        </>
      }
    >
      <div class="media-editor__ocr-results">
        <div class="media-editor__text-mode-switcher">
          <button
            class="media-editor__text-mode-btn"
            onClick={handleAddColumn}
            use:ripple
          >
            <IconTsx icon="plus" />
            <span>Добавить колонку</span>
          </button>
          <div class="media-editor__text-mode-switcher-inner">
            <button
              class="media-editor__text-mode-btn"
              onClick={handleDownloadCSV}
              use:ripple
            >
              <IconTsx icon="download" />
              <span>Скачать CSV</span>
            </button>
          </div>
        </div>
        <Show 
          when={editorState.targetFile?.status === 'done'}
          fallback={
            <div class="media-editor__ocr-placeholder">
              <Show when={editorState.targetFile?.status === 'processing'}>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">⏰</div>
                  <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Обрабатываем документ...</div>
                </div>
              </Show>
              <Show when={editorState.targetFile?.status === 'error'}>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">❌</div>
                  <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Ошибка обработки документа</div>
                </div>
              </Show>
              <Show when={editorState.targetFile?.status === 'pending'}>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; min-height: 200px;">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.7;">⏰</div>
                  <div style="color: var(--secondary-text-color); font-size: 0.9rem; font-weight: 400; line-height: 1.4;">Загружаем документ...</div>
                </div>
              </Show>
            </div>
          }
        >
          <TabContent
            currentTab={currentMode()}
            onContainer={() => {}}
            onScroll={() => {}}
            tabs={{
              table: TableMode,
              edit: EditMode,
              column: ColumnMode
            }}
          />
        </Show>
      </div>
    </Show>
  );
}