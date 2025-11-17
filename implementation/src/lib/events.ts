// Simple event emitter for curriculum updates
export class CurriculumEventEmitter extends EventTarget {
  emitRefresh(certificate?: string) {
    this.dispatchEvent(new CustomEvent('curriculum-refresh', { 
      detail: { certificate } 
    }))
  }
}

export const curriculumEvents = new CurriculumEventEmitter()