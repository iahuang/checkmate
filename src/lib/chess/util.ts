/**
 * Abbreviate a large number to a shorter string.
 * 
 * For example, 1 should be "1", 2532 should be "2.5k", 12452 should be "12k",
 * 1234567 should be "1.2m", 1234567890 should be "1.2b", and so on.
 */
export function abbreviateLargeNumber(n: number): string {
    if (n < 1000) {
        return n.toString();
    }
    
    if (n < 10000) {
        return (n / 1000).toFixed(1) + "k";
    }

    if (n < 1000000) {
        return Math.round(n / 1000) + "k";
    }

    if (n < 10000000) {
        return (n / 1000000).toFixed(1) + "mil";
    }

    if (n < 1000000000) {
        return Math.round(n / 1000000) + "mil";
    }

    if (n < 10000000000) {
        return (n / 1000000000).toFixed(1) + "bil";
    }

    if (n < 1000000000000) {
        return Math.round(n / 1000000000) + "bil";
    }

    return n.toLocaleString();
}

/**
 * Return a range of numbers from start (inclusive) to end (exclusive).
 */
export function range(start: number, end: number): number[] {
    let result: number[] = [];
    for (let i = start; i < end; i++) {
        result.push(i);
    }
    return result;
}