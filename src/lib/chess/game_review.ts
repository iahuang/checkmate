import { Chess } from "chess.js";
import type { BoardState } from "./board";
import {
    Stockfish,
    evalAsAbsoluteScore,
    type StockfishEval,
    getBestMove,
    type EvaluationScore,
} from "./stockfish";

/**
 * The move feedback values are defined in order of priority. In other words, if a move type
 * A is defined before B, and a move matches the criteria for both A and B, then it is
 * considered to be A.
 */
export enum MoveFeedback {
    /**
     * Any move that exists in the opening book and isn't a blunder (i.e. it doesn't lose
     * more than `BLUNDER_CP_LOSS_THRESHOLD` centipawns of positional advantage).
     */
    Book = "book",

    /**
     * Any move involving a piece sacrifice, defined as the following:
     * - A move (A) is played which allows a piece to be captured in the next move. Move
     * A must a move which does not lose positional advantage.
     * - Move (B) is played which captures the piece. Move B must be the best move, but it
     * cannot be the only legal move. At least three points of material must be gained from the
     * capture.
     * - A move (C) is played which does not recapture the piece, but increases positional
     * advantage to a degree that is greater than that before move A was played.
     */
    Brilliant = "brilliant",

    /**
     * Matching the top move in the engine's PV.
     */
    Best = "best",

    /**
     * TBD
     */
    Miss = "miss",

    /**
     * Any move which does not match the top move in the engine's PV, but does not lose
     * more than `GOOD_CP_LOSS_THRESHOLD` centipawns of positional advantage.
     *
     * Alternatively, if a move is forced, it is considered good, even if it loses
     * positional advantage.
     */
    Good = "good",

    /**
     * Any move which does not lose more than `BLUNDER_CP_LOSS_THRESHOLD` centipawns of
     * positional advantage, and is not a good move.
     */
    Dubious = "dubious",

    /**
     * All other moves.
     */
    Blunder = "blunder",
}

const GOOD_CP_LOSS_THRESHOLD = 50;
const BLUNDER_CP_LOSS_THRESHOLD = 200;

export function isPositiveFeedback(feedback: MoveFeedback): boolean {
    return (
        feedback === MoveFeedback.Book ||
        feedback === MoveFeedback.Brilliant ||
        feedback === MoveFeedback.Best ||
        feedback === MoveFeedback.Good
    );
}

export interface Annotation {
    feedback: MoveFeedback;
    description: string | null;

    evaluation: StockfishEval;

    /**
     * The difference in score between the position before the move was played and the
     * position after the move was played, relative to the side to move.
     *
     * For instance, if a move had an evaluation go from -100 to -200, the delta score
     * would be -100 if the side to move was white, and +100 if the side to move was black.
     */
    deltaScore: number;

    /**
     * The best move in the position before the move was played.
     */
    bestMove: string | null;
}

export class TimelineAnnotations {
    private _annotations: (Annotation | null)[];

    constructor(timeline: BoardState[]) {
        this._annotations = [];

        for (let i = 0; i < timeline.length; i++) {
            this._annotations.push(null);
        }
    }

    get length(): number {
        return this._annotations.length;
    }

    /**
     * Computes the accuracy of the game, defined as the number of good moves divided by
     * the total number of moves.
     */
    computeAccuracy(): number {
        let numGoodMoves = 0;

        for (let annotation of this._annotations) {
            if (annotation && isPositiveFeedback(annotation.feedback)) {
                numGoodMoves++;
            }
        }

        return numGoodMoves / this._annotations.length;
    }

    /**
     * Computes the weighted accuracy of the game, defined as the sum of the weights of
     * all moves divided by the total number of moves.
     *
     * The weights are defined as follows:
     * - Best move: 1.00
     * - Brilliant move: 1.00
     * - Good move: 0.50
     * - Dubious move: 0.25
     * - All other moves: 0.00
     */
    computeWeightedAccuracy(): number {
        let weightedScore = 0;

        const BEST_MOVE_WEIGHT = 1;
        const BRILLIANT_MOVE_WEIGHT = 1;
        const GOOD_MOVE_WEIGHT = 0.5;
        const DUBIOUS_MOVE_WEIGHT = 0.25;

        for (let annotation of this._annotations) {
            if (annotation) {
                switch (annotation.feedback) {
                    case MoveFeedback.Best:
                        weightedScore += BEST_MOVE_WEIGHT;
                        break;
                    case MoveFeedback.Brilliant:
                        weightedScore += BRILLIANT_MOVE_WEIGHT;
                        break;
                    case MoveFeedback.Good:
                        weightedScore += GOOD_MOVE_WEIGHT;
                        break;
                    case MoveFeedback.Dubious:
                        weightedScore += DUBIOUS_MOVE_WEIGHT;
                        break;
                }
            }
        }

        return weightedScore / this._annotations.length;
    }

    /**
     * Counts the number of moves annotated with the given feedback type.
     */
    numMovesOfType(feedback: MoveFeedback): number {
        let count = 0;

        for (let annotation of this._annotations) {
            if (annotation && annotation.feedback === feedback) {
                count++;
            }
        }

        return count;
    }

    addAnnotation(index: number, annotation: Annotation) {
        this._annotations[index] = annotation;
    }

    getAnnotationAt(index: number): Annotation | null {
        return this._annotations[index] ?? null;
    }
}

export class GameReviewer {
    private _stockfish: Stockfish;
    private _timelineAnnotations: TimelineAnnotations;
    private _timeline: BoardState[];

    private _busy: boolean;
    private _completed: boolean;
    private _progress: number;

    constructor(timeline: BoardState[]) {
        if (timeline.length === 0) {
            throw new Error("Game timeline must not be empty");
        }

        this._stockfish = new Stockfish();
        this._timelineAnnotations = new TimelineAnnotations(timeline);
        this._timeline = timeline;

        this._busy = false;
        this._completed = false;

        this._progress = 0;
    }

    /**
     * Returns true if the game review is in progress, i.e. Stockfish is currently
     * computing evaluations for the game.
     */
    isBusy(): boolean {
        return this._busy;
    }

    /**
     * Returns true if the game review has been completed, i.e. Stockfish has finished
     * computing evaluations for the game.
     *
     * If this method returns `true`, the game review may be retrieved using the
     * `getGameReview()` method, which is guaranteed to return a non-null value.
     */
    isCompleted(): boolean {
        return this._completed;
    }

    /**
     * Returns the progress of the game review, as a number between 0 and 1.
     *
     * Do not use this method to determine whether the game review has been completed.
     */
    getProgress(): number {
        return this._progress;
    }

    /**
     * Return an array of evaluations for each move in the game as well as the delta
     * score for each move, normalized to the side to move.
     */
    private async _getEvaluations(): Promise<{ eval: StockfishEval; deltaScore: number }[]> {
        let lastState = this._timeline[0];
        let lastScore = 0;

        let evaluations: { eval: StockfishEval; deltaScore: number }[] = [];

        for (let i = 0; i < this._timeline.length; i++) {
            let thisState = this._timeline[i];

            let score: StockfishEval | null = null;

            // The stockfish `get_evaluation_to_depth` method may throw an error if the
            // evaluation could not be computed for some reason, e.g. if the position is
            // invalid.
            try {
                score = await this._stockfish.getEvaluationToDepth(thisState.fen, 10);
            } catch (e) {
                console.error(e);
                throw new Error("Stockfish evaluation failed.");
            }

            // Compute the delta score for this move.

            let thisScore = evalAsAbsoluteScore(score);
            let deltaScore = thisScore - lastScore;

            if (new Chess(lastState.fen).turn() === "b") {
                deltaScore = -deltaScore;
            }

            // Add to `evaluations` array.

            evaluations.push({
                eval: score,
                deltaScore: deltaScore,
            });

            // Update the last state and score.
            lastState = thisState;
            lastScore = thisScore;

            // Update the progress.

            this._progress = (i + 1) / this._timeline.length;
        }

        return evaluations;
    }

    /**
     * While this method is running, the game review is in progress, and
     * Stockfish may not be used for any other purpose.
     *
     * This method may only be called once per instance.
     */
    async beginGameReview(): Promise<void> {
        if (this._busy) {
            throw new Error("Game review already in progress.");
        }

        if (this._completed) {
            throw new Error("Game review already completed.");
        }

        this._stockfish.stopEvaluation(); // Stop any previous evaluations.

        this._busy = true;

        // Compute Stockfish evaluations for each move in the game.
        let evaluations = await this._getEvaluations();

        // Load opening book.
        let openingBook: { [fen: string]: string } = await (
            await fetch("/resources/data/openings.json")
        ).json();

        // Compute the annotations for each move in the game.
        for (let i = 1; i < evaluations.length; i++) {
            let sfEval = evaluations[i].eval;
            let deltaScore = evaluations[i].deltaScore; // in centipawns

            // Determine move feedback and description.
            let feedback: MoveFeedback = MoveFeedback.Good;
            let description = "";

            let movePlayed = this._timeline[i]?.move ?? null;
            let bestMove = evaluations[i - 1].eval.continuations[0].continuation[0];

            let bestMoveFrom = bestMove.slice(0, 2);
            let bestMoveTo = bestMove.slice(2, 4);
            let bestMovePromotion = bestMove.slice(4, 5);
            let bestMoveSan = new Chess(this._timeline[i - 1].fen).move({
                from: bestMoveFrom,
                to: bestMoveTo,
                promotion: bestMovePromotion,
            }).san;

            if (movePlayed && openingBook[movePlayed.after]) {
                // Move played matches an opening book move.
                feedback = MoveFeedback.Book;

                description = `This move plays the <b>${openingBook[movePlayed.after]}</b>.`;
            } else if (movePlayed && movePlayed.from + movePlayed.to === bestMove) {
                // Move played matches top engine move.
                feedback = MoveFeedback.Best;
            } else if ("Mate" in evaluations[i - 1].eval.continuations[0].score && !("Mate" in sfEval.continuations[0].score)) {
                // Move played missed a mate.
                feedback = MoveFeedback.Miss;
            } else if (deltaScore >= -GOOD_CP_LOSS_THRESHOLD) {
                feedback = MoveFeedback.Good;

                description = `A better move was <b>${bestMoveSan}</b>.`;
            } else if (deltaScore >= -BLUNDER_CP_LOSS_THRESHOLD) {
                feedback = MoveFeedback.Dubious;
                description += `The best move was <b>${bestMoveSan}</b>.`;
            } else {
                feedback = MoveFeedback.Blunder;

                if (
                    "Mate" in sfEval.continuations[0].score &&
                    !("Mate" in evaluations[i - 1].eval.continuations[0].score)
                ) {
                    description =
                        "This move allows a mate in <b>" +
                        sfEval.continuations[0].score.Mate +
                        "</b>. ";
                }

                description += `The best move was <b>${bestMoveSan}</b>.`;
            }

            this._timelineAnnotations.addAnnotation(i, {
                feedback: feedback,
                description: description,
                evaluation: sfEval,
                deltaScore: deltaScore,
                bestMove: getBestMove(sfEval),
            });
        }

        this._busy = false;
        this._completed = true;
    }

    /**
     * Returns the timeline annotations for the game review, or null if the game review
     * has not been completed.
     */
    getAnnotations(): TimelineAnnotations | null {
        if (!this._completed) {
            return null;
        }

        return this._timelineAnnotations;
    }
}
