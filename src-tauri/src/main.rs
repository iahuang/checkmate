#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[allow(dead_code)]
use std::{error::Error, sync::Mutex};

use stockfish::{StockfishEval, StockfishError};

pub mod stockfish;

struct App {
    stockfish: Mutex<stockfish::Stockfish>,
}

impl App {
    fn new() -> Self {
        let mut sf = stockfish::Stockfish::new("stockfish");
        let n = sf.auto_set_n_threads();

        println!("Automatically configured Stockfish to use {} threads", n);

        Self {
            stockfish: Mutex::new(sf),
        }
    }

    fn start_evaluating(&self, fen: &str) -> Result<(), StockfishError> {
        let mut stockfish = self.stockfish.lock().unwrap();
        stockfish.restart_evaluation(fen)
    }

    fn get_evaluation(&self) -> Result<Option<StockfishEval>, StockfishError> {
        let mut stockfish = self.stockfish.lock().unwrap();
        stockfish.get_current_evaluation()
    }

    fn stop_evaluation(&self) {
        let mut stockfish = self.stockfish.lock().unwrap();
        stockfish.stop_evaluation();
    }
}

#[tauri::command]
fn start_evaluation(state: tauri::State<App>, fen: String) -> Result<(), String> {
    state.start_evaluating(&fen).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_evaluation(state: tauri::State<App>) -> Result<StockfishEval, String> {
    match state.get_evaluation() {
        Ok(Some(eval)) => Ok(eval),
        Ok(None) => Err("No evaluation available".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn stop_evaluation(state: tauri::State<App>) -> Result<(), String> {
    state.stop_evaluation();

    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    tauri::Builder::default()
        .manage(App::new())
        .invoke_handler(tauri::generate_handler![
            get_evaluation,
            start_evaluation,
            stop_evaluation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
