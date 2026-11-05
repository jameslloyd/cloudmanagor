import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Fallback for <dialog closedby="any"> in browsers without native closedBy support (per modern-web-guidance dialog guide)
if (typeof window !== 'undefined' && 'HTMLDialogElement' in window) {
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const isOutside = (e: PointerEvent, dialog: HTMLDialogElement) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };
    document.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'DIALOG' && target.getAttribute('closedby') === 'any') {
        const dlg = target as HTMLDialogElement;
        if (isOutside(e, dlg)) {
          dlg.dataset.pressedOutside = 'true';
        } else {
          delete dlg.dataset.pressedOutside;
        }
      }
    });
    document.addEventListener('pointerup', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'DIALOG' && target.getAttribute('closedby') === 'any') {
        const dlg = target as HTMLDialogElement;
        if (dlg.dataset.pressedOutside === 'true' && isOutside(e, dlg)) {
          delete dlg.dataset.pressedOutside;
          dlg.close();
        }
      }
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
