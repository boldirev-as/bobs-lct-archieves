import {createEffect, For, Show} from 'solid-js';
import {useMediaEditorContext} from './context';
import {EntityType} from './types';
import {IconTsx} from '../iconTsx';
import ripple from '../ripple'; ripple;

import './exportOverlay.scss';

interface ExportOverlayProps {
  fileId: string;
  fileIndex: number;
}

export default function ExportOverlay(props: ExportOverlayProps) {
  const {editorState, mediaState, actions} = useMediaEditorContext();
  
  // Show overlay only when export tab is active
  const shouldShow = () => editorState.currentTab === 'download';
  
  // Get current file data
  const currentFile = () => mediaState.uploadedFiles.find(file => file.id === props.fileId);
  
  // Get OCR blocks and entities for current file
  const ocrBlocks = () => currentFile()?.result?.result?.textAnnotation?.blocks || [];
  const entities = () => {
    // Try both locations for entities
    const file = currentFile();
    return file?.entities || file?.result?.result?.textAnnotation?.entities || [];
  };
  
  // Get selected column index
  const selectedColumnIndex = () => {
    const index = editorState.selectedColumnIndex || 0;
    console.log('ExportOverlay selectedColumnIndex:', index);
    return index;
  };

  // Handle click on block - add block text to selected column
  const handleBlockClick = (blockIndex: number) => {
    const block = ocrBlocks()[blockIndex];
    if (block) {
      const blockText = block.lines?.map(line => line.text).join(' ') || 'Пустой блок';
      console.log('Adding block to column:', selectedColumnIndex(), blockText);
      actions.addCellToColumn(selectedColumnIndex(), blockText);
    }
  };
  
  // Handle click on entity - add entity text to selected column
  const handleEntityClick = (entityIndex: number) => {
    const entity = entities()[entityIndex];
    if (entity) {
      console.log('Adding entity to column:', selectedColumnIndex(), entity.text);
      actions.addCellToColumn(selectedColumnIndex(), entity.text);
    }
  };
  
  // Entity type colors and icons
  const getEntityTypeColor = (type: EntityType) => {
    switch (type) {
      case 'ФИО': return '#4CAF50';
      case 'место': return '#2196F3';
      case 'время': return '#FF9800';
      case 'событие': return '#9C27B0';
      case 'другое': return '#607D8B';
      default: return '#607D8B';
    }
  };
  
  const getEntityTypeIcon = (type: EntityType) => {
    switch (type) {
      case 'ФИО': return 'user';
      case 'место': return 'location';
      case 'время': return 'clock';
      case 'событие': return 'calendar';
      case 'другое': return 'info';
      default: return 'info';
    }
  };

  return (
    <Show when={shouldShow()}>
      <div class="export-overlay">
        <div class="export-overlay__header">
          <h3>Образы и абзацы</h3>
        </div>
        
        <div class="export-overlay__content">
          {/* Entities Section - 2 columns, above blocks */}
          <Show when={entities().length > 0}>
            <div class="export-overlay__section">
              <h4 class="export-overlay__section-title">Образы</h4>
              <div class="export-overlay__grid export-overlay__grid--entities">
                <For each={entities()}>
                  {(entity, index) => {
                    const block = ocrBlocks()[entity.blockIndex];
                    if (!block) return null;
                    
                    return (
                      <div
                        class="media-editor__radio-item block-selection-item export-overlay__item export-overlay__entity-item"
                        use:ripple
                        onClick={() => handleEntityClick(index())}
                      >
                        <div class="media-editor__radio-content">
                          <div class="export-overlay__entity-header">
                            <IconTsx
                              icon={getEntityTypeIcon(entity.type)}
                              style={`color: ${getEntityTypeColor(entity.type)};`}
                            />
                            <div
                              class="export-overlay__entity-indicator"
                              style={`background-color: ${getEntityTypeColor(entity.type)};`}
                            >
                              {entity.type}
                            </div>
                          </div>
                          <span class="media-editor__radio-text">
                            {entity.text}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
          
          {/* OCR Blocks Section - 2 columns */}
          <Show when={ocrBlocks().length > 0}>
            <div class="export-overlay__section">
              <h4 class="export-overlay__section-title">Абзацы</h4>
              <div class="export-overlay__grid export-overlay__grid--blocks">
                <For each={ocrBlocks()}>
                  {(block, index) => (
                    <div
                      class="media-editor__radio-item block-selection-item export-overlay__item"
                      use:ripple
                      onClick={() => handleBlockClick(index())}
                    >
                      <div class="media-editor__radio-content">
                        <span class="media-editor__radio-text">
                          {block.lines?.map(line => line.text).join(' ') || 'Пустой блок'}
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}