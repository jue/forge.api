export  class Stopwatch {



    constructor() {

        this._lastTime = Date.now();
    }

    start() {

        this._lastTime = Date.now();
    }

    getElapsedMs() {

        const time = Date.now();

        const elapsedMs = time - this._lastTime;

        this._lastTime = time;

        return elapsedMs;
    }
}