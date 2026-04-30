declare module 'pdfjs-dist/build/pdf' {
  export function getDocument(...args: any[]): any
  export const GlobalWorkerOptions: any
  const defaultExport: {
    getDocument: typeof getDocument
    GlobalWorkerOptions: typeof GlobalWorkerOptions
    [key: string]: any
  }
  export default defaultExport
}