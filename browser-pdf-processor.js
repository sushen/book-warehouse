/** PDF preparation runs in the administrator's browser; readers never receive the source early. */
export class BrowserPdfProcessor {
  constructor({ loadPdf, canvasFactory = () => document.createElement('canvas') }) {
    Object.assign(this,{loadPdf,canvasFactory});
  }
  async prepare(file,{bookId,sha256,priceCredits,onProgress=()=>{}}) {
    const raw=new Uint8Array(await file.arrayBuffer());
    if(!raw.length||raw.length>25*1024*1024||new TextDecoder().decode(raw.slice(0,5))!=='%PDF-')throw Error('PDF_TYPE');
    const pdf=await this.loadPdf(raw.slice());
    try {
      if(!Number.isInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>1500)throw Error('PDF_PAGE_LIMIT');
      const pages=[];
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i);let scale=1.35,base64;
        try {
          const size=page.getViewport({scale:1});
          if(size.width*size.height>4000000)throw Error('PDF_PAGE_SIZE');
          for(let attempt=0;attempt<8;attempt++){
            const viewport=page.getViewport({scale}),canvas=this.canvasFactory();
            canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            try {
              await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;
              base64=canvas.toDataURL('image/jpeg',.9).split(',')[1];
            } finally {canvas.width=canvas.height=0;}
            if(base64&&base64.length<800000)break;
            scale*=.75;
          }
          if(!base64||base64.length>=800000)throw Error('PDF_PAGE_SIZE');
          pages.push({mimeType:'image/jpeg',base64});onProgress(i,pdf.numPages);
        } finally {page.cleanup?.();}
      }
      const chunks=[];
      for(let i=0;i<raw.length;i+=450000){const part=raw.subarray(i,i+450000);let binary='';for(let j=0;j<part.length;j+=8192)binary+=String.fromCharCode(...part.subarray(j,j+8192));chunks.push(btoa(binary));}
      return{format:'bw-firestore-pdf-v1',bookId,sha256,priceCredits,pages,chunks};
    } finally {await pdf.destroy?.();}
  }
}
