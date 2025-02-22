import { lib } from "libapps";

import { IDisposable, Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebglAddon } from "xterm-addon-webgl";
import { ImageAddon, IImageAddonOptions } from 'xterm-addon-image';

// customize as needed (showing addon defaults)
const customSettings: IImageAddonOptions = {
  enableSizeReports: true,    // whether to enable CSI t reports (see below)
  pixelLimit: 16777216,       // max. pixel size of a single image
  sixelSupport: true,         // enable sixel support
  sixelScrolling: true,       // whether to scroll on image output
  sixelPaletteLimit: 256,     // initial sixel palette size
  sixelSizeLimit: 25000000,   // size limit of a single sixel sequence
  storageLimit: 128,          // FIFO storage limit in MB
  showPlaceholder: true,      // whether to show a placeholder for evicted images
  iipSupport: true,           // enable iTerm IIP support
  iipSizeLimit: 20000000      // size limit of a single IIP sequence
}

export class Xterm {
    elem: HTMLElement;
    term: Terminal;
    resizeListener: () => void;
    decoder: lib.UTF8Decoder;

    message: HTMLElement;
    messageTimeout: number;
    messageTimer: NodeJS.Timer;

    fitAddon: FitAddon;
    imageAddon: ImageAddon;
    disposables: IDisposable[] = [];


    constructor(elem: HTMLElement) {
        this.elem = elem;
        const isWindows = ['Windows', 'Win16', 'Win32', 'WinCE'].indexOf(navigator.platform) >= 0;
        this.term = new Terminal({
            cursorStyle: "block",
            cursorBlink: true,
            windowsMode: isWindows,
            fontFamily: "DejaVu Sans Mono, Everson Mono, FreeMono, Menlo, Terminal, monospace, Apple Symbols",
            fontSize: 12,
        });

        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);

        this.imageAddon = new ImageAddon(customSettings);
        this.term.loadAddon(this.imageAddon);

        this.message = elem.ownerDocument.createElement("div");
        this.message.className = "xterm-overlay";
        this.messageTimeout = 2000;

        this.resizeListener = () => {
            this.fitAddon.fit();
            this.term.scrollToBottom();
            this.showMessage(String(this.term.cols) + "x" + String(this.term.rows), this.messageTimeout);
        };

        this.term.open(elem);

        this.term.focus()
        this.resizeListener();
        window.addEventListener("resize", () => { this.resizeListener(); });

        this.decoder = new lib.UTF8Decoder()
    };

    info(): { columns: number, rows: number } {
        return { columns: this.term.cols, rows: this.term.rows };
    };

    output(data: string) {
        this.term.write(this.decoder.decode(data));
    };

    showMessage(message: string, timeout: number) {
        this.message.textContent = message;
        this.elem.appendChild(this.message);

        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
        }
        if (timeout > 0) {
            this.messageTimer = setTimeout(() => {
                this.elem.removeChild(this.message);
            }, timeout);
        }
    };

    removeMessage(): void {
        if (this.message.parentNode == this.elem) {
            this.elem.removeChild(this.message);
        }
    }

    setWindowTitle(title: string) {
        document.title = title;
    };

    setPreferences(value: object) {
        Object.keys(value).forEach((key) => {
            if (key && key == "enable-webgl") {
                this.term.loadAddon(new WebglAddon());
            }
        });
    };

    onInput(callback: (input: string) => void) {
        this.disposables.push(this.term.onData((data) => {
            callback(data);
        }));

    };

    onResize(callback: (colmuns: number, rows: number) => void) {
        this.disposables.push(this.term.onResize((data) => {
            callback(data.cols, data.rows);
        }));
    };

    deactivate(): void {
        this.disposables.forEach(d => d.dispose())
        this.term.blur();
    }

    reset(): void {
        this.removeMessage();
        this.term.clear();
    }

    close(): void {
        window.removeEventListener("resize", this.resizeListener);
        this.term.dispose();
    }
}
