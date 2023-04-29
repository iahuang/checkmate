use regex::Regex;
use serde::Serialize;
use subprocess::{Popen, Redirection};
use thiserror::Error;

use std::error::Error;
use std::io::{BufRead, BufReader, Write};
use std::os::fd::{AsRawFd, FromRawFd};
use std::path;
use std::str::FromStr;
use std::sync::mpsc;
use std::thread;

/// Summary of Stockfish's evaluation of a given position.
#[derive(Debug, Serialize)]
pub struct StockfishEval {
    /// Evaluation depth
    pub eval_depth: usize,

    /// Number of nodes evaluated
    pub n_nodes: usize,

    /// Sorted list of continuations, sorted by evaluation score, best first.
    pub continuations: Vec<Continuation>,

    /// Current game outcome. `None` if game is not over, even if the position is a forced mate.
    pub outcome: Option<GameOutcome>,
}

impl StockfishEval {
    pub fn get_best_move(&self) -> Option<String> {
        self.continuations.first()?.continuation.first().cloned()
    }
}

#[derive(Debug, Clone, Copy, Serialize)]
pub enum GameOutcome {
    /// White wins
    WhiteWin,
    /// Black wins
    BlackWin,
    /// Draw
    Draw,
}

/// Represents a single continuation in a Stockfish evaluation.
#[derive(Debug, Serialize)]
pub struct Continuation {
    /// In UCI format.
    pub continuation: Vec<String>,

    /// Evaluation score of the continuation.
    pub score: EvaluationScore,
}

/// Constraint on how long/deeply Stockfish should evaluate a given position.
pub enum EvalConstraint {
    MaxTimeMillis(u64),
    MaxDepth(usize),
}

impl Default for EvalConstraint {
    /// "Default" constraint is a depth of 25.
    fn default() -> Self {
        EvalConstraint::MaxDepth(25)
    }
}

/// Stockfish evaluation metric. Either centipawn advantage or forced mate.
#[derive(Debug, Clone, Copy, Serialize)]
pub enum EvaluationScore {
    /// Material advantage of `n` centipawns. Positive for white, negative for black.
    CentipawnAdvantage(i32),

    /// Forced mate in `n`. Positive for white, negative for black.
    Mate(i32),
}

impl EvaluationScore {
    /// Return `true` if the score represents a forced mate.
    pub fn is_forced_mate(&self) -> bool {
        match self {
            EvaluationScore::Mate(_) => true,
            _ => false,
        }
    }

    /// Return `true` if the score represents a material advantage.
    pub fn is_material_advantage(&self) -> bool {
        match self {
            EvaluationScore::CentipawnAdvantage(_) => true,
            _ => false,
        }
    }

    /// Convert to centipawn advantage. If the score is a forced mate,
    /// return `10000` for white or `-10000` for black.
    pub fn as_metric(&self) -> i32 {
        match self {
            EvaluationScore::CentipawnAdvantage(n) => *n,
            EvaluationScore::Mate(n) => {
                if *n > 0 {
                    10000
                } else {
                    -10000
                }
            }
        }
    }

    /// Values returned by Stockfish are always relative to the side to move.
    ///
    /// This function converts the score to be absolute, given the relative side to move.
    pub fn make_absolute(mut self, relative_to: chess::Color) -> Self {
        match self {
            EvaluationScore::CentipawnAdvantage(ref mut n) => {
                if relative_to == chess::Color::Black {
                    *n = -*n;
                }
            }
            EvaluationScore::Mate(ref mut n) => {
                if relative_to == chess::Color::Black {
                    *n = -*n;
                }
            }
        }

        self
    }
}

/// Represents Stockfish output of the form
/// ```plain
/// info depth {n} seldepth {i} ...
/// ```
/// etc.
#[derive(Debug)]
struct SFEvalInfo {
    pub depth: usize,
    pub continuation: Vec<String>,
    pub score: EvaluationScore,
    pub n_nodes: usize,
    pub multipv: usize,
}

impl SFEvalInfo {
    /// Parse a line of Stockfish output into an `SFEvalInfo` struct.
    pub fn parse(line: &str) -> Option<Self> {
        let parts = line.split(" ").collect::<Vec<_>>();
        let mut depth = 0;
        let mut continuation = vec![];
        let mut score: Option<EvaluationScore> = None;
        let mut n_nodes = 0;
        let mut multipv = 0;

        for (i, part) in parts.iter().enumerate() {
            match *part {
                "info" => {}
                "depth" => {
                    depth = usize::from_str(parts[i + 1]).ok()?;
                }
                "multipv" => {
                    multipv = usize::from_str(parts[i + 1]).ok()?;
                }
                "score" => {
                    let score_str = parts[i + 1];
                    score = if score_str == "mate" {
                        Some(EvaluationScore::Mate(i32::from_str(parts[i + 2]).ok()?))
                    } else {
                        Some(EvaluationScore::CentipawnAdvantage(
                            i32::from_str(parts[i + 2]).ok()?,
                        ))
                    };
                }
                "nodes" => {
                    n_nodes = usize::from_str(parts[i + 1]).ok()?;
                }
                "pv" => {
                    continuation = parts[i + 1..].iter().map(|s| s.to_string()).collect();
                }
                _ => {}
            }
        }

        Some(Self {
            depth,
            continuation,
            score: score?,
            n_nodes,
            multipv,
        })
    }
}

/// Helper object for extracting useful information out of the evaluation output consisting
/// of a lot of lines that look like this:
/// ```plain
/// info depth 7 seldepth 9 multipv 1 score cp 16 nodes 560 nps 186666 hashfull 0 tbhits 0 time 3 pv d2d4 g8f6 c2c4 e7e6 g2g3 f8b4 c1d2 b4e7 f1g2
/// ```
#[derive(Debug)]
struct SFEvalOutputAccumulator {
    info: Vec<SFEvalInfo>,
}

impl SFEvalOutputAccumulator {
    pub fn new() -> Self {
        Self { info: vec![] }
    }

    pub fn clear(&mut self) {
        self.info.clear();
    }

    pub fn process_line(&mut self, line: &str) {
        if let Some(info) = SFEvalInfo::parse(line) {
            self.info.push(info);
        }
    }

    pub fn process_lines(&mut self, lines: &[String]) {
        for line in lines.iter() {
            self.process_line(line);
        }
    }

    /// Derive a summary evaluation from the information accumulated.
    pub fn derive_evaluation(
        &self,
        turn: chess::Color,
        outcome: Option<GameOutcome>,
    ) -> Option<StockfishEval> {
        let info_with_largest_depth = self.info.iter().max_by_key(|x| x.depth)?;
        let depth = info_with_largest_depth.depth;
        let n_nodes = info_with_largest_depth.n_nodes;

        let mut best_continuations = vec![];

        for info in self.info.iter() {
            if info.depth == depth {
                let multipv = info.multipv;

                if multipv > best_continuations.len() {
                    best_continuations.push(Continuation {
                        score: info.score.make_absolute(turn),
                        continuation: info.continuation.clone(),
                    });
                } else {
                    best_continuations[multipv - 1] = Continuation {
                        continuation: info.continuation.clone(),
                        score: info.score.clone().make_absolute(turn),
                    };
                }
            }
        }

        Some(StockfishEval {
            eval_depth: depth,
            n_nodes: n_nodes,
            continuations: best_continuations,
            outcome,
        })
    }
}

#[derive(Debug, Error)]
pub enum StockfishError {
    #[error("Invalid input to Stockfish.")]
    InvalidInput,

    #[error("Stockfish process is busy.")]
    Busy,

    #[error("Stockfish process is not evaluating.")]
    NotEvaluating,
}

#[derive(Debug)]
pub struct Stockfish {
    rx: mpsc::Receiver<String>,
    tx: mpsc::Sender<String>,
    busy: bool,
    accumulator: SFEvalOutputAccumulator,
    current_position: Option<chess::Board>,
}

impl Stockfish {
    pub fn new<P: AsRef<path::Path>>(path: P) -> Self {
        let (rx, tx) = Stockfish::spawn_stockfish_process(path);

        Self {
            rx,
            tx,
            busy: false,
            accumulator: SFEvalOutputAccumulator::new(),
            current_position: None,
        }
    }

    /// Configure the Stockfish process to use the given number of threads, as set
    /// automatically by examining the number of cores on the system.
    ///
    /// Returns the number of cores that were found.
    pub fn auto_set_n_threads(&mut self) -> usize {
        let n_cores = num_cpus::get();
        self.set_n_threads(n_cores);

        n_cores
    }

    pub fn set_n_threads(&mut self, n_cores: usize) {
        self.sf_proc_stdin_writeln(&format!("setoption name Threads value {}", n_cores));
    }

    /// Stop the current evaluation, if any, and wait until the process is ready to
    /// receive new commands.
    pub fn stop_evaluation(&mut self) {
        self.sf_proc_stdin_writeln("stop");
        self.wait_until_ready();
        self.set_not_busy();

        self.accumulator.clear();
    }

    fn assert_not_busy(&self) -> Result<(), StockfishError> {
        if self.busy {
            Err(StockfishError::Busy.into())
        } else {
            Ok(())
        }
    }

    fn set_busy(&mut self) {
        self.busy = true;
    }

    fn set_not_busy(&mut self) {
        self.busy = false;
    }

    /// Start an evaluation of the current board position.
    ///
    /// # Errors
    /// Will return an error if an evaluation is already running.
    pub fn restart_evaluation(&mut self, position_fen: &str) -> Result<(), StockfishError> {
        if self.busy {
            self.stop_evaluation()
        }

        self.assert_not_busy()?;

        self.set_position(position_fen)?;
        self.accumulator.clear();

        self.sf_proc_stdin_writeln("go");
        self.set_busy();

        Ok(())
    }

    /// Get the current evaluation of the current board position.
    ///
    /// # Errors
    /// Will return an error if no evaluation is running.
    pub fn get_current_evaluation(&mut self) -> Result<Option<StockfishEval>, StockfishError> {
        if !self.busy {
            return Err(StockfishError::NotEvaluating.into());
        }

        let lines = self.sf_proc_stdout_readlines();

        self.accumulator.process_lines(&lines);

        let board = self
            .current_position
            .as_ref()
            .ok_or(StockfishError::InvalidInput)?;

        let curr_turn = board.side_to_move();

        // determine game outcome
        let outcome = match board.status() {
            chess::BoardStatus::Ongoing => None,
            chess::BoardStatus::Stalemate => Some(GameOutcome::Draw),
            chess::BoardStatus::Checkmate => match curr_turn {
                chess::Color::White => Some(GameOutcome::BlackWin),
                chess::Color::Black => Some(GameOutcome::WhiteWin),
            },
        };

        match outcome {
            Some(outcome) => {
                self.stop_evaluation();
                Ok(Some(StockfishEval {
                    eval_depth: 0,
                    n_nodes: 0,
                    continuations: vec![],
                    outcome: Some(outcome),
                }))
            }
            None => Ok(self.accumulator.derive_evaluation(curr_turn, outcome)),
        }
    }

    /// Set the current board position.
    fn set_position(&mut self, board_fen: &str) -> Result<(), StockfishError> {
        self.sf_proc_stdin_writeln(format!("position fen {}", board_fen));

        let board = match chess::Board::from_str(board_fen).ok() {
            Some(board) => board,
            None => return Err(StockfishError::InvalidInput.into()),
        };

        // make sure that board is valid
        if !board.is_sane() {
            return Err(StockfishError::InvalidInput.into());
        }

        self.current_position = Some(board);

        Ok(())
    }

    /// Blocking method. Send an `isready` command, and wait until a `readyok` response is received.
    ///
    /// Any other output received during this waiting period will be ignored and discarded.
    pub fn wait_until_ready(&mut self) {
        self.sf_proc_stdin_writeln("isready");

        loop {
            if let Some(line) = self.sf_proc_stdout_readline() {
                if line == "readyok" {
                    break;
                }
            }
        }
    }

    /// Send a command to Stockfish.
    fn sf_proc_stdin_writeln<S: ToString>(&mut self, line: S) {
        self.tx.send(line.to_string()).unwrap();
    }

    /// Non-blocking. Read a line from Stockfish's stdout, if available.
    ///
    /// Returns `None` if no line is available.
    fn sf_proc_stdout_readline(&mut self) -> Option<String> {
        if let Ok(line) = self.rx.try_recv() {
            Some(line)
        } else {
            None
        }
    }

    /// Non-blocking. Read all available lines from Stockfish's stdout.
    ///
    /// Return an empty vector if no lines are available.
    fn sf_proc_stdout_readlines(&mut self) -> Vec<String> {
        let mut out = vec![];

        while let Some(line) = self.sf_proc_stdout_readline() {
            out.push(line);
        }

        out
    }

    /// Spawn a Stockfish child process. Return a `Receiver` object for data from stdout
    /// and a `Sender` object for sending data to stdin.
    fn spawn_stockfish_process<P: AsRef<path::Path>>(
        path: P,
    ) -> (mpsc::Receiver<String>, mpsc::Sender<String>) {
        const STDIN_THREAD_RX_INTERVAL: u64 = 10;

        let (tx_stdout, rx_stdout) = mpsc::channel::<String>();
        let (tx_stdin, rx_stdin) = mpsc::channel::<String>();

        let path = path.as_ref().to_owned();

        let mut process = Popen::create(
            &[path.as_os_str()],
            subprocess::PopenConfig {
                stdout: Redirection::Pipe,
                stdin: Redirection::Pipe,
                ..Default::default()
            },
        )
        .unwrap();

        let process_stdin_fd = process.stdin.as_ref().unwrap().as_raw_fd();

        // Thread for listening to stdout
        thread::spawn(move || {
            let mut reader = BufReader::new(process.stdout.as_mut().unwrap());

            loop {
                let mut out = String::new();
                reader.read_line(&mut out).unwrap();

                tx_stdout.send(out.trim().to_owned()).unwrap();
            }
        });

        // Thread for sending to stdin
        thread::spawn(move || unsafe {
            let mut process_stdin = std::fs::File::from_raw_fd(process_stdin_fd);

            loop {
                match rx_stdin.try_recv() {
                    Ok(msg) => process_stdin.write_all((msg + "\n").as_bytes()).unwrap(),
                    Err(e) => match e {
                        mpsc::TryRecvError::Empty => (),
                        mpsc::TryRecvError::Disconnected => break,
                    },
                }

                // sleep as to avoid using too much of the CPU
                thread::sleep(std::time::Duration::from_millis(STDIN_THREAD_RX_INTERVAL));
            }
        });

        (rx_stdout, tx_stdin)
    }
}
