let max_weight = 10;
let min_weight = 1;
let acc_weights = 0;

let numNodes = 4; // Don't make number of nodes greater the number of available paths
const imagePaths = [
    "/static/assets/images/living-room.png",
    "/static/assets/images/kitchen.png",
    "/static/assets/images/garden.png",
    "/static/assets/images/play-room.png",
    "/static/assets/images/attic.png",
    "/static/assets/images/bathroom.png"
];
const node_image_width = 170;
const backgroundColor = "#E5E7E9";

let path = [];
let pathLinks = [];
let linkIds = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));
let linkWeights = Array.from({ length: numNodes * (numNodes - 1) / 2 }, () => 0);


const graphArea = document.getElementById("graph-area");
// const nodeLabels = [['L', 'Living Room'], ['K', 'Kitchen'], ['B', 'Bathroom'], ['F', 'Front Porch'], ['A', 'Attic'], ['O', 'Office']];

let graphDrawn = false;

let animationData = {
    running: false,
    source: null,
    target: null
};
let walkingFigureGif;


function drawGraph(graph) {
    const width = 1024;
    const height = 768;
    const centerX = width / 2;
    const centerY = height / 2;
    const margin = 70;
    const radius = width < height ? width / 2 - margin : height / 2 - margin;

    // Generate nodes with random positions
    const nodes = d3.range(numNodes).map((d, i) => ({
        id: i,
        x: centerX + radius * Math.cos(2 * Math.PI * i / numNodes),
        y: centerY + radius * Math.sin(2 * Math.PI * i / numNodes)
    }));

    // Generate links (fully connected)
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            links.push({ source: nodes[i], target: nodes[j] });
        }
    }
    const svg = d3.select("#graph-area")
        .select("svg")
        .empty()
        ? d3.select("#graph-area").append("svg")
        : d3.select("#graph-area svg");
    svg.attr("width", 1024)
        .attr("height", 768);
    const container = svg.append("g").attr("id", "graph-container");

    var weight_offset = 50;
    // Draw links
    links.forEach((link, index) => {
        const x1 = link.source.x;
        const y1 = link.source.y;
        const x2 = link.target.x;
        const y2 = link.target.y;

        // Calculate the weight position
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;
        const center_weight_x = (x1 + x2) / 2;
        const center_weight_y = (y1 + y2) / 2;
        
        const distanceFromCenter = Math.sqrt((center_weight_x - centerX) ** 2 + (center_weight_y - centerY) ** 2);
        const delta_diff = Math.max(weight_offset - distanceFromCenter, 0);
        
        const weight_x = center_weight_x + unitX * delta_diff;
        const weight_y = center_weight_y + unitY * delta_diff;

        // store link id
        const linkId = "link" + index;
        const group = container.append("g").attr("id", `${linkId}`);
        linkIds[link.source.id][link.target.id] = linkId;
        linkIds[link.target.id][link.source.id] = linkId;
        linkWeights[linkId] = graph[link.source.id][link.target.id];

        // Draw link
        group.append("line")
            .attr("class", "link")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .attr("stroke", "black")
            .attr("stroke-width", 5);

        group.append("circle")
            .attr("cx", weight_x)
            .attr("cy", weight_y)
            .attr("r", 15)
            .attr("stroke", "black")
            .attr("stroke-width", 2)
            .attr("fill", "none");

        group.append("image")
            .attr("xlink:href", "/static/assets/images/coin.png")
            .attr("x", weight_x - 15)
            .attr("y", weight_y - 15)
            .attr("width", 30);

        group.append("text")
            .attr("class", "edge_weight")
            .attr("x", weight_x)
            .attr("y", weight_y + 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(graph[link.source.id][link.target.id])
            .attr("pointer-events", "none")
            .attr("fill", "black")
            .attr("font-size", "20pt");
        
    });

    // Draw nodes
    const imageLoadPromises = nodes.map(node => {
        return new Promise((resolve, reject) => {
            const group = container.append("g");
            const imagePath = imagePaths[node.id];

            const tmpImg = new Image();
            tmpImg.src = imagePath;

            tmpImg.onload = function() {
                const naturalWidth = tmpImg.naturalWidth;
                const naturalHeight = tmpImg.naturalHeight;
                const scaleFactor = node_image_width / naturalWidth;
                const scaledWidth = naturalWidth * scaleFactor;
                const scaledHeight = naturalHeight * scaleFactor;

                group.append("rect")
                    .attr("class", "node")
                    .attr("id", `rect-${node.id}`)
                    .attr("x", node.x - (scaledWidth + 2) / 2)
                    .attr("y", node.y - (scaledHeight + 2) / 2)
                    .attr("width", scaledWidth + 2)
                    .attr("height", scaledHeight + 2)
                    .attr("fill", backgroundColor)
                    .attr("stroke", "black")
                    .attr("stroke-width", "2")
                    .attr("stroke-dasharray", "7,1");

                group.append("image")
                    .attr("class", "node")
                    .attr("id", `image-${node.id}`)
                    .attr("x", node.x - scaledWidth / 2)
                    .attr("y", node.y - scaledHeight / 2)
                    .attr("width", scaledWidth)
                    .attr("height", scaledHeight)
                    .attr("xlink:href", imagePath)
                    .on("mouseover", function() { handleMouseOver.call(this, node); })
                    .on("mouseout", function() { handleMouseOut.call(this, node); })
                    .on("click", function() {
                        clickNode(node);
                    });

                resolve();
            };

            tmpImg.onerror = function() {
                console.error(`Failed to load image for node ${node.id}`);
                resolve();
            };
        });
    });

    initWeightDiv();
    Promise.all(imageLoadPromises).then(() => {
        pushNode(nodes[0]);
        socket.emit("message_command", {
            "command": {
                "event": "update_path",
                "path": path
            },
            "room": self_room,
            "user_id": self_user
        });
    });
}
function initWeightDiv(){
    const accWeightsDiv = document.createElement("div");
    accWeightsDiv.className = "acc-weight";
    accWeightsDiv.style.position = "absolute";
    accWeightsDiv.style.left = "20px";
    accWeightsDiv.style.top = "80px"; // updated y position to avoid overlap
    accWeightsDiv.style.display = "flex";
    accWeightsDiv.style.alignItems = "middle";

    const coinImage = document.createElement("img");
    coinImage.src = "/static/assets/images/coin.png";
    coinImage.style.width = "30px";
    coinImage.style.height = "30px";
    accWeightsDiv.appendChild(coinImage);

    const weightText = document.createElement("span");
    weightText.id = "weight-text";
    weightText.style.marginLeft = "1px";
    weightText.style.pointerEvents = "none";
    weightText.textContent = ": " + acc_weights;
    weightText.style.fontSize = "30px";
    accWeightsDiv.appendChild(weightText);

    graphArea.appendChild(accWeightsDiv);
}
function updateWeights(){
    acc_weights = 0;
    for (const linkId of pathLinks){
        acc_weights += linkWeights[linkId];
    }
    const weightText = document.querySelector("#weight-text");
    weightText.textContent = ": " + acc_weights;
}
function clickNode(clickedNode){
    const clickedNodeIndex = path.indexOf(clickedNode);
    if (clickedNodeIndex === -1){ // clicked node is not in path
        const last_node = path[path.length - 1];
        const linkId = linkIds[clickedNode.id][last_node.id];

        pathLinks.push(linkId)
        pushNode(clickedNode);

        if (path.length === numNodes){
            const linkId = linkIds[clickedNode.id][path[0].id];
            pathLinks.push(linkId);
            pushNode(path[0]);
        }
    }else{
        if (path.length === 1){
            return;
        }
        else if (clickedNodeIndex === 0 && path.length === numNodes){
            path.push(clickedNode);
        }
        else if (clickedNodeIndex === path.length - 1){
            path.pop();
        }
        else{
            while (path.length > clickedNodeIndex + 1){
                path.pop();
            }
            pathLinks = [];
            path.forEach((node, index) => {
                if (index < path.length - 1) {
                    const nextNode = path[index + 1];
                    const linkId = linkIds[node.id][nextNode.id];
                    pathLinks.push(linkId);
                }
            });
        }
    }

    updateGraphColoring();
    updateWeights();

    if (animationData.running){
        if (walkingFigureGif){
            walkingFigureGif.remove();
        }
        animationData.running = false;
    }
    socket.emit("message_command",
        {
            "command": {
                "event": "update_path",
                "path": path
            },
            "room": self_room,
            "user_id": self_user
        }
    )
}

function pushNode(node){
    path.push(node);
    makeNodeNew(node);
}
function updateGraphColoring(){
    for (const linkId of linkIds.flat()) {
        if (linkId == 0){
            continue;
        }
        const linkElement = d3.select(`#${linkId}`);
        resetLink(linkElement);
    }
    for (let i = 0; i < numNodes; i++) {
        const node = { id: i }; // dummy node
        resetNode(node);
    }
    path.forEach((node, index) => {
        if (index < path.length - 1) {
            const nextNode = path[index + 1];
            const linkId = linkIds[node.id][nextNode.id];
            // console.log(`link from path: ${linkId}`);
            const linkElement = d3.select(`#${linkId}`);
            colorLinkVisited(linkElement);
        }
        makeNodeGreen(node);
    });
    makeNodeNew(path[path.length - 1]);
}
function makeNodeNew(node){
    makeNodeGreen(node);
    // const stickFigureId = `stick-figure-${node.id}`;
    let stickFigure = d3.select(`#stick-figure`);
    const nodeImage = d3.select(`#image-${node.id}`);
    const nodeImageWidth = nodeImage.attr("width");
    const nodeImageHeight = nodeImage.attr("height");
    const svgCenterX = d3.select("#graph-container").node().getBoundingClientRect().width / 2;
    const tmpImg = new Image();
    tmpImg.src = "/static/assets/images/standing-stick.png";
    tmpImg.onload = function() {
        const originalStickFigureWidth = tmpImg.naturalWidth;
        const originalStickFigureHeight = tmpImg.naturalHeight;
        const scaleFactor = nodeImageHeight / originalStickFigureHeight;
        const scaledStickFigureWidth = originalStickFigureWidth * scaleFactor;
        const scaledStickFigureHeight = originalStickFigureHeight * scaleFactor;

        // Add figure to svg if it doesn't exist
        if (stickFigure.empty()) {
            const svgContainer = d3.select("#graph-container");
            stickFigure = svgContainer.append("image")
                .attr("id", "stick-figure")
                .attr("href", "/static/assets/images/standing-stick.png")
                .attr("height", scaledStickFigureHeight)
                .attr("width", scaledStickFigureWidth)
        }
        stickFigure.attr("y", node.y - nodeImageHeight / 2);
        if (node.x < svgCenterX) {
                stickFigure.attr("x", 0)
                .attr("transform", `scale(-1, 1) translate(${- (node.x - nodeImageWidth / 2)}, 0)`)
            } else {
                stickFigure.attr("x", node.x + nodeImageWidth / 2)
                .attr("transform", `scale(1, 1)`);
        }
    };
    tmpImg.onerror = function() {
        console.error("Failed to load stick figure image");
    };
            
}
function makeNodeOld(node){
    return;
    // TODO: Remove Figure from node
}
function makeNodeOrange(node){
    const nodeElement = document.getElementById(`rect-${node.id}`);
    nodeElement.style.stroke = "orange";
}
function makeNodeGreen(node){
    const nodeElement = document.getElementById(`rect-${node.id}`);
    nodeElement.style.stroke = "lightgreen";
}
function colorNodeHovering(node){
    const nodeElement = document.getElementById(`rect-${node.id}`);
    nodeElement.style.strokeWidth = "4";
    makeNodeOrange(node);
}
function colorNodeMouseOut(node){
    const nodeElement = document.getElementById(`rect-${node.id}`);
    nodeElement.style.strokeWidth = "2";
    resetNode(node);
}
function resetNode(node){
    const nodeElement = document.getElementById(`rect-${node.id}`);
    if (!path.includes(node)){
        nodeElement.style.stroke = "black";
    }else{
        makeNodeGreen(node);
    }
}
function colorLinkVisited(link){
    link.selectAll(".link").style("stroke", "lightgreen").style("stroke-width", "8px");
    link.selectAll(".circle").style("stroke", "lightgreen");
}

function resetLink(link){
    link.selectAll(".link").style("stroke", "black").style("stroke-width", "5px");
    link.selectAll(".circle").style("stroke", "black");
}
function colorLinkHovering(link){
    link.selectAll(".link").style("stroke", "orange").style("stroke-width", "8px");
    link.selectAll(".circle").style("stroke", "orange");
}
function handleMouseOver(node) {
    this.style.opacity = "0.5";
    colorNodeHovering(node);
    if (path.includes(node)) {
        return;
    }

    if (path.length > 0) {
        const lastNode = path[path.length - 1];
        const linkId = linkIds[node.id][lastNode.id];
        const linkElement = d3.select(`#${linkId}`);
        colorLinkHovering(linkElement);

        const dx = node.x - lastNode.x;
        const dy = node.y - lastNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;
        const source = { x: lastNode.x + dx / 2 - unitX * 60, y: lastNode.y + dy / 2 - unitY * 60 };
        const target = { x: lastNode.x + dx / 2 + unitX * 60, y: lastNode.y + dy / 2 + unitY * 60 };

        walkingFigureGif = d3.select("#graph-container")
            .append("image")
            .attr("xlink:href", "/static/assets/images/walk-cycle-alpha-30.gif")
            .attr("width", 50)
            .attr("height", 50)
            .attr("x", - 25) // Offset x by half the width to center horizontally
            .attr("y", - 50) // Offset y by the height to align bottom with source coordinates
            ;
            
            
        animationData.running = true;
        animationData.source = source;
        animationData.target = target;
        animateGif(source, target);
    }
}

function animateGif(source, target) {
    if (!animationData.running) return;
    const current_source = animationData.source;
    const current_target = animationData.target;
    if (
        Math.abs(current_source.x - source.x) > 1e-6 || 
        Math.abs(current_source.y - source.y) > 1e-6 || 
        Math.abs(current_target.x - target.x) > 1e-6 || 
        Math.abs(current_target.y - target.y) > 1e-6
    ) {
        return;
    }

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const angleTransform = dx < 0 ? 180 - angle : angle;
    const flip = dx < 0 ? -1 : 1;

    walkingFigureGif.transition()
        .duration(700)
        .attrTween("transform", function() {
            return function(t) {
                const x = source.x + (target.x - source.x) * t;
                const y = source.y + (target.y - source.y) * t;
                
                return `
                    translate(${x}, ${y})
                    scale(${flip}, 1)
                    rotate(${angleTransform}, 0, 0)
                `;
            };
        })
        .on("end", function() {
            // Restart the animation
            animateGif(current_source, current_target);
        });
}

function handleMouseOut(node) {
    this.style.opacity = "1";
    colorNodeMouseOut(node);

    if (path.includes(node)){
        return;
    }
    if (path.length > 0) {
        const lastNode = path[path.length - 1];
        const linkId = linkIds[node.id][lastNode.id];
        const linkElement = d3.select(`#${linkId}`);
        resetLink(linkElement);
    }

    // Stop the animation
    animationData.running = false;
    if (walkingFigureGif) {
        walkingFigureGif.remove();
    }
}

$(`#submit_button`).click(() => {
    console.log("SUBMITTING")
    socket.emit("message_command",
        {
            "command": "stop",
            "room": self_room,
            "user_id": self_user
        }
    )
})

$(`#reset-graph-button`).click(() => {
    let updated_path = path.length > 1;
    path = [path[0]];
    pathLinks = [];
    // for (const linkId of linkIds.flat()) {
    //     const linkElement = d3.select(`#${linkId}`);
    //     resetLink(linkElement);
    // }
    // pathLinks = [];
    // while (path.length > 1){
    //     node = path.pop();
    //     resetNode(node);
    // }
    // makeNodeNew(path[0]);
    updateGraphColoring();
    updateWeights();
    if (updated_path){
        socket.emit("message_command", {
            "command": {
                "event": "update_path",
            "path": path
            },
            "room": self_room,
            "user_id": self_user
        })
    }
})

// !!only for --dev!!
socket.emit("message_command", {
    "command": {
        "event": "start_game",
    },
    "room": self_room,
    "user_id": self_user
})
$(document).ready(function() {
    socket.on("command", function(data) {
        if (typeof(data.command === 'object')){
            if (data.command.event == "draw_graph"){
                console.log("draw graph,GraphDrawn status: ", graphDrawn);
                if (graphDrawn){
                    return;
                }
                if (data.command.user_id !== self_user.id){
                    return;
                }
                graphDrawn = true;
    
                // Remove previous graph if it exists
                // d3.select("#graph-area").select("#graph-container").remove();
                const graphContainer = document.querySelector("#graph-container");
                const totalWeightDiv = document.querySelector(".total-weight");
                const accWeightDiv = document.querySelector(".acc-weight");
                if (graphContainer){
                    graphContainer.remove();
                }
                if (totalWeightDiv){
                    totalWeightDiv.remove();
                }
                if (accWeightDiv){
                    accWeightDiv.remove();
                }

                // Read in data
                numNodes = data.command.size;
                max_weight = data.command.max_weight;
                min_weight = data.command.min_weight;
                acc_weights = 0;

                path = [];
                pathLinks = []; 
                linkIds = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));
                linkWeights = Array.from({ length: numNodes * (numNodes - 1) / 2 }, () => 0);
                graph = data.command.graph;
                drawGraph(graph);
            }
            else if (data.command.event == "new_episode"){
                console.log("New episode");
                console.log("GraphDrawn status: ", graphDrawn);
                graphDrawn = false;
                socket.emit("message_command", {
                    "command": {
                        "event": "document_ready",
                    },
                    "room": self_room,
                    "user_id": self_user
                })
            }
        }
    });

    socket.emit("message_command", {
        "command": {
            "event": "document_ready",
        },
        "room": self_room,
        "user_id": self_user
    })
})