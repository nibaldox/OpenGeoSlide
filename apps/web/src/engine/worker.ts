// Punto de entrada del Web Worker. Solo conecta el transporte con el despachador.

import { createDispatcher, type Request, type Response } from './protocol';
import { selectEngine } from './select';

interface WorkerScope {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: Response): void;
}

const scope = self as unknown as WorkerScope;

let holder: ReturnType<typeof selectEngine> | null = null;
const dispatch = createDispatcher(() => {
  holder ??= selectEngine();
  return holder;
});

scope.onmessage = (event: MessageEvent<Request>) => {
  void dispatch(event.data).then((response) => scope.postMessage(response));
};
