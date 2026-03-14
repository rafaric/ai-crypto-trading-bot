import { SignalGenerated } from './events';
export interface IExecutionEngine {
    executeSignal(signal: SignalGenerated): Promise<boolean>;
}
