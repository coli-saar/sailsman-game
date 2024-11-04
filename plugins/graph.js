parent_div = document.getElementById('tracking-area')

var config = {
    type: Phaser.AUTO,
    width: parent_div.offsetWidth,
    height: parent_div.offsetHeight,
    backgroundColor: '#ffffff',
    parent: 'tracking-area',
    scene: {
        create: createFullyConnectedGraph
    }
};

var game = new Phaser.Game(config);

function createFullyConnectedGraph() {
    const scene = this;
    const numNodes = 5;
    const centerX = game.scale.width / 2;
    const centerY = game.scale.height / 2;
    const nodeRadius = 60;
    const margin = 50;
    const radius = Math.min(game.scale.width, game.scale.height) / 2 - margin;

    // Create nodes
    const nodes = [];
    for (let i = 0; i < numNodes; i++) {
        const angle = (2 * Math.PI * i) / numNodes;
        const x = centerX + radius * Math.cos(angle);
        // const x = centerX
        const y = centerY + radius * Math.sin(angle);
        // const y = centerY

        const node = scene.add.circle(x, y, nodeRadius, 0xffffff)
            .setStrokeStyle(2, 0x000000)
            .setInteractive({ useHandCursor: true });

        const label = scene.add.text(x, y, i + 1, {
            fontSize: '20px',
            color: '#000'
        }).setOrigin(0.5);

        // Event listeners for interaction
        node.on('pointerover', function () {
            node.setFillStyle(0x808080);
            label.setColor('#ffffff');
        });

        node.on('pointerout', function () {
            node.setFillStyle(0xffffff);
            label.setColor('#000000');
        });

        node.on('pointerdown', function () {
            console.log("clicked node ", i);
        });

        nodes.push({ id: i, x: x, y: y, node: node });
    }

    // Create links (fully connected graph)
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const source = nodes[i];
            const target = nodes[j];

            // Calculate directional vector and endpoints
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const unitX = dx / distance;
            const unitY = dy / distance;

            const x1 = source.x + unitX * nodeRadius;
            const y1 = source.y + unitY * nodeRadius;
            const x2 = target.x - unitX * nodeRadius;
            const y2 = target.y - unitY * nodeRadius;

            // Draw line
            scene.add.line(0, 0, x1, y1, x2, y2, 0x000000)
                .setLineWidth(1)
                .setOrigin(0);
        }
    }
}

// $(document).ready(function () {
//     const game = new Phaser.Game(config)
//     createFullyConnectedGraph()
// })