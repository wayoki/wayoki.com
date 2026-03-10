const word = "АХ";
const resize_debounce_ms = 100;

function laughLine() {
    const link = document.getElementById("laugh-link");
    if (!link) return;

    const targetWidth = link.clientWidth;
    if (targetWidth <= 0) return;

    const styles = window.getComputedStyle(link);
    const font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    const canvas = laughLine.canvas || (laughLine.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.font = font;
    const unitWidth = ctx.measureText(word).width;
    if (unitWidth <= 0) {
        link.textContent = word;
        return;
    }

    const repeats = Math.max(1, Math.ceil(targetWidth / unitWidth) + 1);
    link.textContent = word.repeat(repeats);
}

function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    };
}

window.addEventListener("DOMContentLoaded", laughLine);
window.addEventListener("resize", debounce(laughLine, resize_debounce_ms));
