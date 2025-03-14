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
// const node_image_width = 120;
const backgroundColor = "#E5E7E9";

let path = [];
let pathLinks = [];
let linkIds = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));
let linkWeights = Array.from({ length: numNodes * (numNodes - 1) / 2 }, () => 0);


const graphArea = document.getElementById("graph-area");
// const nodeLabels = [['L', 'Living Room'], ['K', 'Kitchen'], ['B', 'Bathroom'], ['F', 'Front Porch'], ['A', 'Attic'], ['O', 'Office']];

let graphDrawn = false;
let endTutorialScreen = false;

let animationData = {
    running: false,
    source: null,
    target: null
};
let walkingFigureGif;

// Styling
const BORDERSIZE = 2;
const NODEIMAGEWIDTH = 120;
const NODEMARGIN = 4;
var WEIGHTOFFSET = 50;

const loadedImages = {};



function showEndTutorialScreen(coinsCollected, goldCoinsCollected) {
    const graphArea = document.getElementById("graph-area");
    // Remove existing message if present
    const graphContainer = document.querySelector("#graph-container");
    if (graphContainer) {
        graphContainer.remove();
    }
    const resetGraphButton = document.getElementById("reset-graph-button");
    resetGraphButton.style.display = "none";
    const accWeightsDiv = document.querySelector("#acc-weights-div");
    accWeightsDiv.innerHTML = "";

    const textDiv = document.createElement("div");
    textDiv.id = "end-tutorial-screen";
    textDiv.style.position = "absolute";
    textDiv.style.top = "50%";
    textDiv.style.left = "50%";
    textDiv.style.transform = "translate(-50%, -50%)";
    textDiv.style.textAlign = "center";
    textDiv.style.fontWeight = "bold";
    textDiv.style.fontSize = "large";
    textDiv.style.padding = "10px";
    textDiv.style.border = "2px solid lightgreen";
    if (coinsCollected == goldCoinsCollected){
        textDiv.innerHTML = `
        <span style="color: black;">You completed the tutorial episode with ${coinsCollected} \u{1FA99} collected. This is the most you could have gotten. Well done!</span>
        `;
    } else {
        textDiv.innerHTML = `
        <span style="color: black;">You completed the tutorial episode with ${coinsCollected} \u{1FA99} collected.
        You could have gotten ${goldCoinsCollected} \u{1FA99}. Try to get the most coins possible next time!</span>
        `;
    }
    const submitButtonMessage = document.createElement("div");
    submitButtonMessage.id = "submit-button-message";
    submitButtonMessage.style.position = "absolute";
    submitButtonMessage.style.top = "75%";
    submitButtonMessage.style.left = "50%";
    submitButtonMessage.style.transform = "translate(-50%, 0)";
    submitButtonMessage.style.textAlign = "center";
    submitButtonMessage.style.fontWeight = "bold";
    submitButtonMessage.style.fontSize = "large";
    submitButtonMessage.style.color = "red";
    submitButtonMessage.style.padding = "10px";
    // submitButtonMessage.style.animation = "blink 1s infinite alternate";
    submitButtonMessage.innerHTML = `
    <span style="color: red;">Click the submit button again to continue to the next episode.</span>
    `;
    
    graphArea.appendChild(textDiv); // Append to graph-area
    graphArea.appendChild(submitButtonMessage);
    endTutorialScreen = true;
}

function hideEndTutorialScreen(){
    if (!endTutorialScreen){
        return;
    }
    const textDiv = document.getElementById("end-tutorial-screen");
    textDiv.remove();
    const submitButtonMessage = document.getElementById("submit-button-message");
    submitButtonMessage.remove();
    const resetGraphButton = document.querySelector("#reset-graph-button");
    resetGraphButton.style.display = "";
    endTutorialScreen = false;
}


function drawGraph(graph) {
    const svg = d3.select("#graph-area")
        .select("svg")
        .empty()
        ? d3.select("#graph-area").append("svg").attr("id", "graph-svg")
        : d3.select("#graph-area svg");

    const container = svg.append("g").attr("id", "graph-container");
    const boundingBox = svg.node().getBoundingClientRect();
    const centerX = boundingBox.width / 2;
    const centerY = boundingBox.height / 2;
        // const margin = 0;
        // const nodeImageWidth = boundingBox.width / 10;
    
    // Generate nodes with random positions
    const nodes = d3.range(numNodes).map((d, i) => ({
        id: i,
    }));
    
    
    // Draw nodes
    nodes.forEach(node => {
        const group = container.append("g").attr("id", `node-${node.id}`);

        const tmpImg = loadedImages[node.id];
        const naturalWidth = tmpImg.naturalWidth;
        const naturalHeight = tmpImg.naturalHeight;
        const imageAspectRatio = naturalWidth / naturalHeight;
        const imgWidth = NODEIMAGEWIDTH;
        const imgHeight = NODEIMAGEWIDTH / imageAspectRatio;

        const radius = Math.min(boundingBox.width - imgWidth, boundingBox.height - imgHeight) / 2 - NODEMARGIN;

        const x = centerX + radius * Math.cos(2 * Math.PI * node.id / numNodes);
        const y = centerY + radius * Math.sin(2 * Math.PI * node.id / numNodes);

        node.x = x;
        node.y = y;

        group.append("rect")
            .attr("class", "node")
            .attr("id", `rect-${node.id}`)
            .attr("x", x)
            .attr("y", y)
            .attr("transform", `translate(${(- (imgWidth + BORDERSIZE)) / 2}, ${(- (imgHeight + BORDERSIZE)) / 2})`)
            .attr("width", imgWidth + BORDERSIZE)
            .attr("height", imgHeight + BORDERSIZE)
            .attr("fill", backgroundColor)
            .attr("stroke", "black")
            .attr("stroke-width", BORDERSIZE)
            .attr("stroke-dasharray", "7,1");

        group.append("image")
            .attr("class", "node")
            .attr("id", `image-${node.id}`)
            .attr("x", x)
            .attr("y", y)
            .attr("transform", `translate(${- imgWidth / 2}, ${- imgHeight / 2})`)
            .attr("width", imgWidth)
            .attr("height", imgHeight)
            .attr("xlink:href", tmpImg.src)
            .on("mouseover", function() { handleMouseOver.call(this, node); })
            .on("mouseout", function() { handleMouseOut.call(this, node); })
            .on("click", function() {
                clickNode(node);
        });
    });

    const firstNode = nodes[0];

    const nodeImage = d3.select(`#image-${firstNode.id}`);
    const nodeWidth = nodeImage.attr("width");
    const nodeHeight = nodeImage.attr("height");

    // Define the arrow pointing from top right to bottom left
    // Define arrow properties
    const arrowLength = 50;
    const startX = firstNode.x + nodeWidth / 2 + arrowLength / Math.sqrt(2), startY = firstNode.y - nodeHeight / 2 - arrowLength / Math.sqrt(2); // Arrow start position
    const endX = startX - arrowLength / Math.sqrt(2);
    const endY = startY + arrowLength / Math.sqrt(2);

    // Add an arrow marker definition
    container.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 10)
        .attr("refY", 5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 Z")
        .attr("fill", "black");

    // Draw the diagonal arrow
    container.append("line")
        .attr("id", "start-arrow")
        .attr("x1", startX)
        .attr("y1", startY)
        .attr("x2", endX)
        .attr("y2", endY)
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)");

    // Add the label above the arrow with wrapping
    const angle = 180 + Math.atan2(endY - startY, endX - startX) * 180 / Math.PI; // Calculate the angle in degrees
    const textWidth = 80;
    container.append("foreignObject")
        .attr("id", "start-arrow-label")
        .attr("x", endX - (textWidth - arrowLength / Math.sqrt(2)) / 2)
        .attr("y", startY)
        .attr("width", textWidth) // Fixed width matching arrow length
        .attr("height", 50) // Adjust as needed
        .attr("transform", `rotate(${angle}, ${(startX + endX) / 2}, ${(startY + endY) / 2}) translate(0, -20)`) // Rotate the text
        .append("xhtml:div")
        .style("font", "12px sans-serif")
        .style("text-align", "center")
        .style("word-wrap", "break-word")
        .style("color", "black")
        .html("You start and end here");

    initWeightDiv();

    // Generate links (fully connected)
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            links.push({ source: nodes[i], target: nodes[j] });
        }
    }

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
        const delta_diff = Math.max(WEIGHTOFFSET - distanceFromCenter, 0);
        
        const weight_x = center_weight_x + unitX * delta_diff;
        const weight_y = center_weight_y + unitY * delta_diff;

        // store link id
        const linkId = "link" + index;
        const group = container.insert("g", ":first-child").attr("id", `${linkId}`);
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
            .attr("stroke-width", 4)
            .attr("fill", "#ffffff");

        group.append("image")
            .attr("xlink:href", loadedImages["coin"].src)
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
    pushNode(nodes[0]);
    socket.emit("message_command", {
        "command": {
            "event": "update_path",
            "path": path
        },
        "room": self_room,
        "user_id": self_user
    });
}

function resizeGraph() {
    if (endTutorialScreen){
        return;
    }
    const svg = d3.select("#graph-area svg");
    const boundingBox = svg.node().getBoundingClientRect();
    const centerX = boundingBox.width / 2;
    const centerY = boundingBox.height / 2;

    const nodes = d3.range(numNodes).map((d, i) => ({
        id: i,
    }));

    nodes.forEach((node, i) => {
        const nodeImg = d3.select(`#image-${i}`);
        const nodeRect = d3.select(`#rect-${i}`);
        const currentNodeImageWidth = nodeImg.attr("width");
        const currentNodeImageHeight = nodeImg.attr("height");
        const imageAspectRatio = currentNodeImageWidth / currentNodeImageHeight;
        const imgWidth = NODEIMAGEWIDTH;
        const imgHeight = NODEIMAGEWIDTH / imageAspectRatio;

        const radius = Math.min(boundingBox.width - imgWidth, boundingBox.height - imgHeight) / 2 - NODEMARGIN;
        const x = centerX + radius * Math.cos(2 * Math.PI * node.id / numNodes);
        const y = centerY + radius * Math.sin(2 * Math.PI * node.id / numNodes);

        node.x = x;
        node.y = y;

        nodeImg.attr("x", x);
        nodeImg.attr("y", y);

        nodeRect.attr("x", x);
        nodeRect.attr("y", y);

    });

    // Update link positions in the DOM
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            links.push({ source: nodes[i], target: nodes[j] });
        }
    }

    links.forEach((link, index) => {
        const x1 = link.source.x;
        const y1 = link.source.y;
        const x2 = link.target.x;
        const y2 = link.target.y;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;
        const center_weight_x = (x1 + x2) / 2;
        const center_weight_y = (y1 + y2) / 2;
        
        const distanceFromCenter = Math.sqrt((center_weight_x - centerX) ** 2 + (center_weight_y - centerY) ** 2);
        const delta_diff = Math.max(WEIGHTOFFSET - distanceFromCenter, 0);
        
        const weight_x = center_weight_x + unitX * delta_diff;
        const weight_y = center_weight_y + unitY * delta_diff;

        const linkId = "link" + index;
        const linkElement = d3.select(`#${linkId}`);
        linkElement.select("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2);
        linkElement.select("circle").attr("cx", weight_x).attr("cy", weight_y);
        linkElement.select("image").attr("x", weight_x - 15).attr("y", weight_y - 15);
        linkElement.select("text").attr("x", weight_x).attr("y", weight_y + 2);
    });
    makeNodeNew(path[path.length - 1]);

    // update start arrow
    const firstNode = nodes[0];

    const nodeImage = d3.select(`#image-${firstNode.id}`);
    const nodeWidth = nodeImage.attr("width");
    const nodeHeight = nodeImage.attr("height");

    // Define the arrow pointing from top right to bottom left
    // Define arrow properties
    const arrowLength = 50;
    const startX = firstNode.x + nodeWidth / 2 + arrowLength / Math.sqrt(2), startY = firstNode.y - nodeHeight / 2 - arrowLength / Math.sqrt(2); // Arrow start position
    const endX = startX - arrowLength / Math.sqrt(2);
    const endY = startY + arrowLength / Math.sqrt(2);

    // Add an arrow marker definition
    const startArrow = document.querySelector("#start-arrow");
    startArrow.setAttribute("x1", startX);
    startArrow.setAttribute("y1", startY);
    startArrow.setAttribute("x2", endX);
    startArrow.setAttribute("y2", endY);

    // Draw the diagonal arrow

    // Add the label above the arrow with wrapping
    const angle = 180 + Math.atan2(endY - startY, endX - startX) * 180 / Math.PI; // Calculate the angle in degrees
    const textWidth = 80;
    const label = document.querySelector("#start-arrow-label");
    label.setAttribute("x", endX - (textWidth - arrowLength / Math.sqrt(2)) / 2);
    label.setAttribute("y", startY);
    label.setAttribute("transform", `rotate(${angle}, ${(startX + endX) / 2}, ${(startY + endY) / 2}) translate(0, -20)`);

    // update acc weights div
    const accWeightsDiv = document.querySelector("#acc-weights-div");
    const graphSvg = document.querySelector("#graph-svg");
    const graphSvgBoundingBox = graphSvg.getBoundingClientRect();
    const parentBoundingBox = graphSvg.parentElement.getBoundingClientRect();
    accWeightsDiv.style.left = (graphSvgBoundingBox.left - parentBoundingBox.left) + "px";
}

// Add event listener for window resize
window.addEventListener("resize", resizeGraph);

function initWeightDiv(){
    const accWeightsDiv = document.querySelector("#acc-weights-div");
    const graphSvg = document.querySelector("#graph-svg");
    const graphSvgBoundingBox = graphSvg.getBoundingClientRect();
    const parentBoundingBox = graphSvg.parentElement.getBoundingClientRect();

    accWeightsDiv.style.left = (graphSvgBoundingBox.left - parentBoundingBox.left) + "px";

    let coinImage = document.querySelector("#coin-image");
    if (!coinImage){
        coinImage = document.createElement("img");
        coinImage.id = "coin-image";
        coinImage.src = loadedImages["coin"].src;
        coinImage.style.width = "30px";
        coinImage.style.height = "30px";
        accWeightsDiv.appendChild(coinImage);
    }

    let weightText = document.querySelector("#weight-text");
    if (!weightText){
        weightText = document.createElement("span");
        weightText.id = "weight-text";
        weightText.style.marginLeft = "1px";
        weightText.style.pointerEvents = "none";
        weightText.style.fontSize = "30px";
        accWeightsDiv.appendChild(weightText);
    }
    weightText.textContent = ": " + acc_weights;
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
    const oldPath = [...path];

    if (clickedNodeIndex === -1){ // clicked node is not in path
        const last_node = path[path.length - 1];
        const linkId = linkIds[clickedNode.id][last_node.id];
        pathLinks.push(linkId)
        path.push(clickedNode);
    }else{
        if (path.length === 1){
            return;
        }
        else if (clickedNodeIndex === 0 && path.length === numNodes){
            pathLinks.push(linkIds[path[path.length - 1].id][clickedNode.id]);
            path.push(clickedNode);

        }
        else if (clickedNodeIndex === path.length - 1){
            path.pop();
            pathLinks.pop();
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
    
    const pathLengthDiff = path.length - oldPath.length;
    if (pathLengthDiff > 0){
        for (let i = 0; i < pathLengthDiff; i++){
            const linkId = pathLinks[pathLinks.length - (i + 1)];
            const linkElement = d3.select(`#${linkId}`);
            animateCoin(linkElement);
        }
    }

    updateGraphColoring();
    if (pathLengthDiff <= 0){
        updateWeights();
    }

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
            const linkElement = d3.select(`#${linkId}`);
            colorLinkVisited(linkElement);
        }
        makeNodeGreen(node);
    });
    makeNodeNew(path[path.length - 1]);
    if (path.length === numNodes){
        makeStartNodeBlinking();
    }else{
        stopStartNodeBlinking();
    }
}
function makeNodeNew(node){
    makeNodeGreen(node);
    let stickFigure = d3.select(`#stick-figure`);
    const nodeImage = d3.select(`#image-${node.id}`);
    const nodeImageWidth = parseFloat(nodeImage.attr("width"));
    const nodeImageHeight = parseFloat(nodeImage.attr("height"));
    const nodeImageX = parseFloat(nodeImage.attr("x"));
    const nodeImageY = parseFloat(nodeImage.attr("y"));
    const svgCenterX = d3.select("#graph-svg").node().getBoundingClientRect().width / 2;
    
    let originalStickFigureWidth = 0;
    let originalStickFigureHeight = 0;
    
    if (stickFigure.empty()){
        const svgContainer = d3.select("#graph-container");
        stickFigure = svgContainer.append("image")
        .attr("id", "stick-figure")
        .attr("href", loadedImages["standing-stick"].src);
        originalStickFigureWidth = loadedImages["standing-stick"].naturalWidth;
        originalStickFigureHeight = loadedImages["standing-stick"].naturalHeight;
    }
    else{
        originalStickFigureWidth = stickFigure.attr("width");
        originalStickFigureHeight = stickFigure.attr("height");
    }
    const scaleFactor = nodeImageHeight / originalStickFigureHeight;
    const scaledStickFigureWidth = originalStickFigureWidth * scaleFactor;
    const scaledStickFigureHeight = originalStickFigureHeight * scaleFactor;
    
    stickFigure.attr("height", scaledStickFigureHeight)
    .attr("width", scaledStickFigureWidth)
    .attr("y", nodeImageY - nodeImageHeight / 2);
    
    if (nodeImageX < svgCenterX) {
        stickFigure.attr("x", 0)
        .attr("transform", `scale(-1, 1) translate(${- (nodeImageX - nodeImageWidth / 2)}, 0)`)
    } else {
        stickFigure.attr("x", nodeImageX + nodeImageWidth / 2)
            .attr("transform", `scale(1, 1)`);
    }   
}

let nodeBlinking;
let arrowBlinking;
function makeStartNodeBlinking(){  
    makeNodeOrange(path[0]);
    const currentlyBlinking = nodeBlinking || arrowBlinking;

    nodeBlinking = true;
    arrowBlinking = true;
    if (!currentlyBlinking){
        blinkingStep();
    }
}
function blinkingStep(){
    if (!nodeBlinking && !arrowBlinking){
        return;
    }

    const startNode = path[0];
    const nodeElement = d3.selectAll(`#rect-${startNode.id}`);
    const arrowLabel = d3.selectAll("#start-arrow-label");
    const arrow = d3.selectAll("#start-arrow");
    nodeElement.interrupt().attr("opacity", 1);
    arrowLabel.interrupt().attr("opacity", 1);
    arrow.interrupt().attr("opacity", 1);

    if (nodeBlinking){
        nodeElement.transition()
            .duration(1000)
            .attr("opacity", nodeElement.attr("opacity") == 1 ? 0 : 1)
            .on("end", function(){
                nodeElement.attr("opacity", 1);
            });
    }
    if (arrowBlinking){
        arrow.transition()
            .duration(1000)
            .attr("opacity", arrow.attr("opacity") == 1 ? 0 : 1)
            .on("end", function(){
                arrow.attr("opacity", 1);
            });
        arrowLabel.transition()
            .duration(1000)
            .attr("opacity", arrowLabel.attr("opacity") == 1 ? 0 : 1)
            .on("end", function(){
                arrowLabel.attr("opacity", 1);
                blinkingStep();
            });
    }
}
function stopStartNodeBlinking(){
    if (!nodeBlinking && !arrowBlinking){
        return;
    }
    nodeBlinking = false;
    arrowBlinking = false;
}
function stopNodeBlinking(){
    const startNode = path[0];
    const nodeElement = d3.select(`#rect-${startNode.id}`);
    nodeElement.interrupt().attr("opacity", 1);
    nodeBlinking = false;
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
    if (node.id == path[0].id && path.length == numNodes){
        stopNodeBlinking();
    }
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
        if (node.id == path[0].id && path.length == numNodes){
            makeStartNodeBlinking();
        }
    }
}
function colorLinkVisited(link){
    link.selectAll(".link").style("stroke", "lightgreen").style("stroke-width", "8px");
    link.selectAll("circle").style("stroke", "lightgreen");
}

function resetLink(link){
    if (pathLinks.includes(link.attr("id"))){
        return;
    }
    link.selectAll(".link").style("stroke", "black").style("stroke-width", "5px");
    const circleElement = link.selectAll("circle");
    circleElement.style("stroke", "black");
    const coinElement = link.select("image");
    if (coinElement.empty()){
        link.insert("image", "text")
            .attr("xlink:href", loadedImages["coin"].src)
            .attr("x", parseFloat(circleElement.attr("cx")) - 15)
            .attr("y", parseFloat(circleElement.attr("cy")) - 15)
            .attr("width", 30);
    }else{
        coinElement.interrupt();
        coinElement.attr("transform", "translate(0,0)");
    }
}
function colorLinkHovering(link){
    link.selectAll(".link").style("stroke", "orange").style("stroke-width", "8px");
    link.selectAll("circle").style("stroke", "orange");
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
        const nodeX = parseFloat(d3.select(`#rect-${node.id}`).attr("x"));
        const nodeY = parseFloat(d3.select(`#rect-${node.id}`).attr("y"));
        const lastNodeX = parseFloat(d3.select(`#rect-${lastNode.id}`).attr("x"));
        const lastNodeY = parseFloat(d3.select(`#rect-${lastNode.id}`).attr("y"));
        colorLinkHovering(linkElement);

        const dx = nodeX - lastNodeX;
        const dy = nodeY - lastNodeY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;
        const source = { x: lastNodeX + dx / 2 - unitX * 60, y: lastNodeY + dy / 2 - unitY * 60 };
        const target = { x: lastNodeX + dx / 2 + unitX * 60, y: lastNodeY + dy / 2 + unitY * 60 };

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

function animateCoin(link){
    const attrWeightDiv = document.querySelector("#acc-weights-div");
    const weightCoin = attrWeightDiv.querySelector("img");
    const parentDiv = document.querySelector("#graph-area");
    const relX = parentDiv.getBoundingClientRect().x;
    const relY = parentDiv.getBoundingClientRect().y;
    const coin = link.select("image");
    
    const startX = coin.node().getBoundingClientRect().x - relX;
    const startY = coin.node().getBoundingClientRect().y - relY;

    const endX = weightCoin.getBoundingClientRect().x - relX;
    const endY = weightCoin.getBoundingClientRect().y - relY;

    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const unitX = dx / distance;
    const unitY = dy / distance;

    const oscillationPeriod = 400;
    let oscillationFrame = 0;
    const duration = 800;
    const amplitude = 40;
    let randomOffset = amplitude / 4 + 3 * Math.random() * amplitude / 4;
    coin.transition()
        .duration(duration)
        .attrTween("transform", function() {
            return function(t) {
                oscillationFrame = Math.floor(t * duration);
                if (oscillationFrame >= oscillationPeriod){
                    randomOffset = randomOffset / 4 + 3 * Math.random() * randomOffset / 4;
                }
                oscillationFrame = oscillationFrame % oscillationPeriod;
                const offset = randomOffset * Math.sin((oscillationFrame / oscillationPeriod) * Math.PI * 2);
                const x = dx * t + unitX * offset;
                const y = dy * t - unitY * offset;
                return `translate(${x}, ${y})`;
            };
        })
        .on("end", function() {
            updateWeights();
            coin.remove();
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
    path = [path[0]];
    pathLinks = [];

    updateGraphColoring();
    updateWeights();
})

function loadImages(){
    let imageLoadPromises = [];
    for (let i = 0; i < imagePaths.length; i++){
        const imagePath = imagePaths[i];
        const tmpImg = new Image();
        imageLoadPromises.push(new Promise((resolve) => {
            tmpImg.onload = () => resolve();
            tmpImg.onerror = () => {
                console.error(`Failed to load image: ${imagePath}`);
                resolve(); // Resolve anyway to not block other images
            };
            tmpImg.src = imagePath;
        }));
        loadedImages[i] = tmpImg;
    }
    
    const tmpImg = new Image();
    imageLoadPromises.push(new Promise((resolve) => {
        tmpImg.onload = () => resolve();
        tmpImg.onerror = () => {
            console.error("Failed to load standing-stick image");
            resolve();
        };
        tmpImg.src = "/static/assets/images/standing-stick.png";
    }));
    loadedImages["standing-stick"] = tmpImg;
    
    const tmpCoin = new Image();
    imageLoadPromises.push(new Promise((resolve) => {
        tmpCoin.onload = () => resolve();
        tmpCoin.onerror = () => {
            console.error("Failed to load coin image");
            resolve();
        };
        tmpCoin.src = "/static/assets/images/coin.png";
    }));
    loadedImages["coin"] = tmpCoin;
    
    return Promise.all(imageLoadPromises);
}


// !!only for --dev!!
// socket.emit("message_command", {
//    "command": {
//        "event": "start_game",
//    },
//    "room": self_room,
//    "user_id": self_user
// })

$(document).ready(function() {
    socket.on("command", function(data) {
        if (typeof(data.command === 'object')){
            if (data.command.event == "draw_graph"){
                hideEndTutorialScreen();
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
                graphDrawn = false;
                socket.emit("message_command", {
                    "command": {
                        "event": "document_ready",
                    },
                    "room": self_room,
                    "user_id": self_user
                })
            }
            else if (data.command.event == "show_end_tutorial_screen"){
                showEndTutorialScreen(data.command.coins_collected, data.command.gold_coins_collected);
            }
        }
    });
        
    loadImages().then(() => {
        console.log("images loaded");
        socket.emit("message_command", {
            "command": {
                "event": "document_ready",
            },
            "room": self_room,
            "user_id": self_user
        })
    });
})
