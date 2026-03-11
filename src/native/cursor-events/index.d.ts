import EventEmitter from 'events';

declare class MouseEvents extends EventEmitter {
    getPaused(): boolean;
    pauseMouseEvents(): boolean;
    resumeMouseEvents(): number;
}

declare const instance: MouseEvents;
export default instance;
