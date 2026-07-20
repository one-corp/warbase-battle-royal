const fs = require('fs');
let css = fs.readFileSync('src/ui/style.css', 'utf-8');

// Replace all #00ffcc with #ff003c
css = css.replace(/rgba\(0, 255, 204/g, 'rgba(255, 0, 60'); // #ff003c is roughly rgb(255,0,60)
css = css.replace(/#00ffcc/g, '#ff003c');
css = css.replace(/#88ccff/g, '#ffccd5'); // light red
css = css.replace(/#88aadd/g, '#dd8899'); // dim red
css = css.replace(/#0055ff, #ff003c/g, '#a00020, #ff003c'); // Button gradient

fs.writeFileSync('src/ui/style.css', css);
