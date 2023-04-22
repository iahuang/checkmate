export interface StockfishEval {
	eval_depth: number;
	n_nodes: number;
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
