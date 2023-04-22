import { invoke } from "@tauri-apps/api";

export class Stockfish {
    start_evaluation(fen: string) {
        invoke("start_evaluation", { fen });
    }

    get_evaluation(): Promise<StockfishEval> {
        return invoke("get_evaluation", {});
    }
}

export interface StockfishEval {
	eval_depth: number;
	n_nodes: number;
	continuations: Continuation[];
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
