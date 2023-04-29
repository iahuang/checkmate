import { invoke } from "@tauri-apps/api";

function asyncSleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A wrapper around the Stockfish engine.
 *
 * This object does not maintain any state; *however*, all instances of this class
 * will refer to the same Stockfish instance, and caution should be taken to avoid
 * conflicting calls.
 */
export class Stockfish {
    /**
     * Begins the evaluation of the given FEN string.
     *
     * If an evaluation is already in progress, it will be stopped.
     */
    startEvaluation(fen: string) {
        invoke("start_evaluation", { fen });
    }

    /**
     * Returns the current evaluation.
     */
    getEvaluation(): Promise<StockfishEval> {
        return invoke("get_evaluation", {});
    }

    /**
     * Stops the current evaluation.
     */
    stopEvaluation() {
        invoke("stop_evaluation", {});
    }

    async getEvaluationToDepth(fen: string, depth: number): Promise<StockfishEval> {
        this.startEvaluation(fen);

        while (true) {
            let sfEval: StockfishEval;

            try {
                sfEval = await this.getEvaluation();
            } catch (e) {
                continue;
            }

            if (sfEval.eval_depth >= depth || sfEval.outcome !== null) {
                this.stopEvaluation();
                return sfEval;
            }

            await asyncSleep(20);
        }
    }
}

export interface StockfishEval {
    eval_depth: number;
    n_nodes: number;
    continuations: Continuation[];
    outcome: null | "WhiteWin" | "BlackWin" | "Draw";
}

export interface Continuation {
    continuation: string[];
    score: EvaluationScore;
}

export type EvaluationScore =
    | {
          CentipawnAdvantage: number;
      }
    | {
          Mate: number;
      };

export function evalAsAbsoluteScore(sfEval: StockfishEval): number {
    let outcomeScores = {
        Draw: 0,
        WhiteWin: 1000,
        BlackWin: -1000,
    };

    if (sfEval.outcome !== null) {
        return outcomeScores[sfEval.outcome];
    }

    let continuation = sfEval.continuations[0];

    if (!continuation) {
        throw new Error("No continuation found.");
    }

    let score = continuation.score;

    if ("Mate" in score) {
        return score.Mate < 0 ? -1000 : 1000;
    }

    if ("CentipawnAdvantage" in score) {
        return score.CentipawnAdvantage;
    }

    throw new Error("No score found.");
}

export function getBestMove(sfEval: StockfishEval): string | null {
    let continuation = sfEval.continuations[0];

    if (!continuation) {
        return null;
    }

    return continuation.continuation[0];
}