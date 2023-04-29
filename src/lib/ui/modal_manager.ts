import type { ComponentType, SvelteComponent, SvelteComponentTyped } from "svelte";
import { writable, type Writable } from "svelte/store";

interface ComponentProps<T> {
    modalManager: ModalManager,
    args: T 
}

export type ModalComponent<T> = ComponentType<SvelteComponentTyped<ComponentProps<T>, {}, {}>>;

export default class ModalManager {
    modal: Writable<ModalComponent<any> | null>;
    private _modal: ModalComponent<any> | null;

    args: Writable<any> = writable(null);
    private _args: any;

    constructor() {
        this.modal = writable(null);
        this._modal = null;
    }

    /**
     * Open the given component as a modal. If `force` is true, the modal will be
     * opened even if another modal is already open.
     */
    open<T>(component: ModalComponent<T>, args: T, force: boolean = false) {
        if (this._modal && !force) {
            return;
        }

        this._modal = component;
        this.modal.set(component);
        this._args = args;
        this.args.set(args);
    }

    /**
     * Close the currently open modal.
     */
    close() {
        this._modal = null;
        this.modal.set(null);
    }
}
