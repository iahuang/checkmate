import type { MoveFeedback } from "../chess/game_review";

export function pathForMoveFeedbackIcon(moveFeedback: MoveFeedback): string {
    return `/resources/assets/reactions/${moveFeedback}.png`
}