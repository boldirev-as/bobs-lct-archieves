/**
 * Простой извлекатель изображений из PDF
 * Использует Canvas API для рендеринга страниц PDF как изображений
 */

export interface ExtractedImage {
  name: string;
  blob: Blob;
  page: number;
  width: number;
  height: number;
}

/**
 * Извлекает все изображения из PDF файла, рендеря каждую страницу
 */
export async function extractImagesFromPDF(pdfFile: File): Promise<ExtractedImage[]> {
  const extractedImages: ExtractedImage[] = [];
  
  try {
    // Создаем URL для PDF файла
    const pdfUrl = URL.createObjectURL(pdfFile);
    
    // Загружаем PDF.js с CDN
    await loadPDFJS();
    
    // Загружаем PDF
    const pdf = await loadPDF(pdfUrl);
    
    // Рендерим каждую страницу как изображение
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Увеличиваем масштаб для лучшего качества
      
      // Создаем canvas для рендеринга
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Рендерим страницу
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Конвертируем canvas в blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/png');
      });
      
      extractedImages.push({
        name: `page_${pageNum}.png`,
        blob: blob,
        page: pageNum,
        width: viewport.width,
        height: viewport.height
      });
    }
    
    // Очищаем URL
    URL.revokeObjectURL(pdfUrl);
    
    return extractedImages;
    
  } catch (error) {
    console.error('Error extracting images from PDF:', error);
    throw new Error(`Failed to extract images from PDF: ${error}`);
  }
}

/**
 * Загружает PDF.js с CDN
 */
function loadPDFJS(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Проверяем, не загружен ли уже PDF.js
    if ((window as any).pdfjsLib) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    
    script.onload = () => {
      // Настраиваем worker
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load PDF.js'));
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Загружает PDF документ
 */
function loadPDF(pdfUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const loadingTask = (window as any).pdfjsLib.getDocument(pdfUrl);
    
    loadingTask.promise.then((pdf: any) => {
      resolve(pdf);
    }).catch((error: any) => {
      reject(error);
    });
  });
}


