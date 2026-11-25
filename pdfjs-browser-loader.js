import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import rendererUrl from 'pdfjs-dist/build/pdf.renderer.min.mjs?url';
import { BrowserPdfProcessor } from './browser-pdf-processor.js';
GlobalWorkerOptions.workerSrc=workerUrl;
GlobalWorkerOptions.rendererSrc=rendererUrl;
export function createPdfProcessor(){
  const assets=new URL('pdf-assets/',document.baseURI).href;
  return new BrowserPdfProcessor({loadPdf:async data=>{
    const task=getDocument({data,isEvalSupported:false,enableXfa:false,standardFontDataUrl:assets+'standard_fonts/',cMapUrl:assets+'cmaps/',cMapPacked:true,wasmUrl:assets+'wasm/',iccUrl:assets+'iccs/'});
    task.onPassword=()=>{task.destroy();};
    return task.promise;
  }});
}
