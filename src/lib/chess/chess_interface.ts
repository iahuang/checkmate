import {
    BoardState,
    positionsEqual,
    type MoveResult,
    type SquareIndex,
    type TimelinePosition,
    BoardTimeline,
    type PGNMetadata,
} from "./board";
import { writable } from "svelte/store";
import type { Writable } from "svelte/store";
import { TimelineAnnotations } from "./game_review";

export interface TimelineState {
    position: TimelinePosition;
    main: BoardState[];
    hypothetical: BoardState[];
}

/**
 * Even though the stores are writable, they should only be modified by the
 * `ChessInterface` class. Modifying them directly will cause the interface
 * to become out of sync and will not cause any internal state to be updated.
 */
export interface Stores {
    boardState: Writable<BoardState>;
    timelineState: Writable<TimelineState>;
    annotations: Writable<TimelineAnnotations>;
    matchMetadata: Writable<PGNMetadata>;
}

/**
 * Svelte-friendly interface for interacting with most of the chess logic.
 */
export class ChessInterface {
    private _timeline: BoardTimeline;
    private _annotations: TimelineAnnotations | null;
    private _matchMetadata: PGNMetadata | null = null;
    stores: Stores;

    constructor() {
        this._timeline = new BoardTimeline();
        this._annotations = null;
        this._matchMetadata = null;

        this.stores = {
            boardState: writable(this._timeline.getBoardState()),
            timelineState: writable(this._makeTimelineState()),
            annotations: writable(this._makeAnnotations()),
            matchMetadata: writable(this._makeMatchMetadata()),
        };
    }

    private _makeMatchMetadata(): PGNMetadata {
        if (this._matchMetadata) {
            return this._matchMetadata;
        }

        return {};
    }

    private _makeAnnotations(): TimelineAnnotations {
        if (this._annotations) {
            return this._annotations;
        }

        return new TimelineAnnotations(this._timeline.getMainTimeline());
    }

    private _makeTimelineState(): TimelineState {
        return {
            position: this._timeline.getPosition(),
            main: this._timeline.getMainTimeline(),
            hypothetical: this._timeline.getHypotheticalTimeline(),
        };
    }

    private _updateStores() {
        this.stores.boardState.set(this._timeline.getBoardState());
        this.stores.timelineState.set(this._makeTimelineState());
        this.stores.annotations.set(this._makeAnnotations());
        this.stores.matchMetadata.set(this._makeMatchMetadata());
    }

    makeMove(fromIndex: SquareIndex, toIndex: SquareIndex, promotion?: string): MoveResult {
        let lastPosition = this._timeline.getPosition();
        let result = this._timeline.makeMove(fromIndex, toIndex, promotion);

        if (result.valid && !positionsEqual(result.newPosition, lastPosition)) {
            this._updateStores();
        }

        return result;
    }

    loadAnnotations(annotations: TimelineAnnotations) {
        this._annotations = annotations;
        this._updateStores();
    }

    clearAnnotations() {
        this._annotations = null;
        this._updateStores();
    }

    previous(): TimelinePosition {
        let lastPosition = this._timeline.getPosition();
        let newPosition = this._timeline.previous();

        if (!positionsEqual(newPosition, lastPosition)) {
            this._updateStores();
        }

        return newPosition;
    }

    next(): TimelinePosition {
        let lastPosition = this._timeline.getPosition();
        let newPosition = this._timeline.next();

        if (!positionsEqual(newPosition, lastPosition)) {
            this._updateStores();
        }

        return newPosition;
    }

    jumpToEnd(): TimelinePosition {
        let lastPosition = this._timeline.getPosition();
        let newPosition = this._timeline.jumpToEnd();

        if (!positionsEqual(newPosition, lastPosition)) {
            this._updateStores();
        }

        return newPosition;
    }

    jumpToStart(): TimelinePosition {
        let lastPosition = this._timeline.getPosition();
        let newPosition = this._timeline.jumpToStart();

        if (!positionsEqual(newPosition, lastPosition)) {
            this._updateStores();
        }

        return newPosition;
    }

    loadPGN(pgn: string) {
        this._matchMetadata = this._timeline.loadPGN(pgn);
        this._updateStores();
    }
}
