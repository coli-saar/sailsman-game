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


const trackingArea = document.getElementById("tracking-area");
const nodeLabels = [['L', 'Living Room'], ['K', 'Kitchen'], ['B', 'Bathroom'], ['F', 'Front Porch'], ['A', 'Attic'], ['O', 'Office']];

let graphDrawn = false;

let animationData = {
    running: false,
    source: null,
    target: null
};
let walkingFigureGif;

// function createGraphData(graph) {
//     const width = 1024;
//     const height = 768;
//     const centerX = width / 2;
//     const centerY = height / 2;
//     const margin = 70;
//     const radius = width < height ? width / 2 - margin : height / 2 - margin;

//     // Generate nodes with random positions
//     const nodes = d3.range(numNodes).map((d, i) => ({
//         id: i,
//         x: centerX + radius * Math.cos(2 * Math.PI * i / numNodes),
//         y: centerY + radius * Math.sin(2 * Math.PI * i / numNodes)
//     }));

//     // Generate links (fully connected)
//     const links = [];
//     for (let i = 0; i < nodes.length; i++) {
//         for (let j = i + 1; j < nodes.length; j++) {
//             links.push({ source: nodes[i], target: nodes[j] });
//         }
//     }

//     // Calculate weights
//     var total_weight = Math.ceil((max_weight + min_weight) * links.length / 2);
//     var weights = [];
//     var current_weight_sum = 0;
//     for (let i = 0; i < links.length; i++) {
//         var target_mean = Math.min(max_weight, Math.max(min_weight, Math.floor((total_weight - current_weight_sum) / (links.length - i))));
//         var std = Math.min(max_weight - target_mean, target_mean - min_weight);
//         var current_min_weight = target_mean - Math.ceil(std * ((links.length - i - 1) / links.length));
//         var current_max_weight = target_mean + Math.ceil(std * ((links.length - i - 1) / links.length));
//         var w = Math.floor(Math.random() * (current_max_weight - current_min_weight + 1)) + current_min_weight;
//         current_weight_sum += w;
//         weights.push(w);
//     }

//     return { nodes, links, weights };
// }

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
    // const { nodes, links, weights } = createGraphData();

    const svg = d3.select("#tracking-area")
        .select("svg")
        .empty()
        ? d3.select("#tracking-area").append("svg")
        : d3.select("#tracking-area svg");

    svg.attr("width", 1024)
        .attr("height", 768);

    const container = svg.append("g").attr("id", "graph-container");
    // console.table(`Graph: ${graph}`);
    // console.log(`graph values: ${graph[0][1]}`);

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

            // group.append("text")
            //     .attr("class", "node_text")
            //     .attr("x", node.x)
            //     .attr("y", node.y)
            //     .attr("text-anchor", "middle")
            //     .attr("dominant-baseline", "central")
            //     .text(nodeLabels[node.id][0])
            //     .attr("fill", "white")
            //     .style("pointer-events", "none")
            //     .style("font-size", "40pt");
        });
    });

    drawCollectedCoins();
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
function drawCollectedCoins(){
    // Deprecated
    // var total_edge_weight = 0;
    // for (let w of weights) {
    //     total_edge_weight += w;
    // }

    const accWeightsDiv = document.createElement("div");
    accWeightsDiv.className = "acc-weight";
    accWeightsDiv.style.position = "absolute";
    accWeightsDiv.style.left = "20px";
    accWeightsDiv.style.top = "80px"; // updated y position to avoid overlap
    accWeightsDiv.textContent = "\u{1FA99}: " + acc_weights;
    accWeightsDiv.style.fontSize = "30px";

    // trackingArea.appendChild(totalWeightDiv);
    trackingArea.appendChild(accWeightsDiv);
}
// Call the function to create and draw the graph
// createFullyConnectedGraph = () => {
//     drawGraph();
// };

// function updateLegend(numRows) {
//     // Get or create the table element
//     let table = document.getElementById("legend");
//     if (!table) {
//         table = document.createElement("table");
//         table.id = "legend";
//         table.style.position = "absolute";
//         table.style.top = "50px";
//         // table.style.right = "-50px";
//         trackingArea.appendChild(table);
//     }
    
//     // Clear existing table content
//     table.innerHTML = "";


//     // Create table body and populate with node labels
//     let tbody = document.createElement("tbody");
    
//     nodeLabels.slice(0, numRows).forEach(([label, name]) => {
//         let row = document.createElement("tr");
        
//         let td1 = document.createElement("td");
//         td1.style.textAlign = "left";
//         td1.style.fontSize = "30px";
//         td1.style.fontWeight = "bold";
//         td1.style.padding = "5px 20px"
//         td1.textContent = label;
//         let td2 = document.createElement("td");
//         td2.style.textAlign = "left";
//         td2.style.fontSize = "30px";
//         td2.style.padding = "10px 20px"
//         td2.textContent = name;
        
//         row.appendChild(td1);
//         row.appendChild(td2);
//         tbody.appendChild(row);
//     });

//     table.appendChild(tbody);
// }


function clickNode(clickedNode){
    // console.log("clicke node: " + clickedNode.id);
    // if (path.length < 1){
    //     pushNode(clickedNode);
    // }
    // else{
    // Check whether clicked node is in the path already
    var updated_path = false;
    for (let i=0; i<path.length; i++){
        const n = path[i];
        if (n === clickedNode){
            if (path.length === 1){
                return;
            }
            if (i === path.length - 1){
                resetNode(clickedNode);
                path.pop();
                last_link_id = pathLinks.pop();
                const linkElement = d3.select(`#${last_link_id}`);
                resetLink(linkElement);
                makeNodeNew(path[path.length - 1]);
            }
            else{
                while (pathLinks.length > i){
                    last_link_id = pathLinks.pop();
                    const linkElement = d3.select(`#${last_link_id}`);
                    resetLink(linkElement);
                }
                // let j = path.length - 1;
                while (path.length > i + 1){
                    node = path.pop();
                    resetNode(node);
                }
                makeNodeNew(path[i]);
            }
            updateWeights();
            updated_path = true;
        }
        // }
    }
    if (updated_path == false){
        const last_node = path[path.length - 1];
        const linkId = linkIds[clickedNode.id][last_node.id];
        const linkElement = d3.select(`#${linkId}`);

        pathLinks.push(linkId)
        makeNodeOld(last_node);
        pushNode(clickedNode);
        colorLinkVisited(linkElement);

        if (path.length === numNodes){
            const linkId = linkIds[clickedNode.id][path[0].id];
            const linkElement = d3.select(`#${linkId}`);
            colorLinkVisited(linkElement);
            pathLinks.push(linkId);
        }
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
function updateWeights(){
    acc_weights = 0;
    for (const linkId of pathLinks){
        acc_weights += linkWeights[linkId];
    }
    const accWeigthDiv = document.querySelector(".acc-weight");
    accWeigthDiv.textContent = "\u{1FA99}: " + acc_weights;
}

function pushNode(node){
    path.push(node);
    makeNodeNew(node);
}
function makeNodeNew(node){
    const nodeElement = document.getElementById(`rect-${node.id}`);
    nodeElement.style.stroke = "lightgreen";
}
function makeNodeOld(node){
    const nodeElement = document.getElementById(`rect-${node.id}`);
    nodeElement.style.stroke = "orange";
}
function resetNode(node){
    const nodeElement = document.getElementById(`rect-${node.id}`);
    nodeElement.style.stroke = "black";
}

function colorLinkVisited(link){
    link.selectAll(".link").style("stroke", "orange").style("stroke-width", "8px");
}
function colorLinkAccepting(link){
    link.selectAll(".link").style("stroke", "lightgreen").style("stroke-width", "8px");
}
function resetLink(link){
    link.selectAll(".link").style("stroke", "black").style("stroke-width", "5px");
}

function handleMouseOver(node) {
    this.style.opacity = "0.5";
    // this.parentNode.querySelector("text").style.fill = "black";
    if (path.includes(node)) {
        return;
    }

    if (path.length > 0) {
        const lastNode = path[path.length - 1];
        const linkId = linkIds[node.id][lastNode.id];
        const linkElement = d3.select(`#${linkId}`);
        linkElement.selectAll(".link").style("stroke", "lightgreen").style("stroke-width", "8px");

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
    // this.parentNode.querySelector("text").style.fill = "white";

    if (path.includes(node)){
        return;
    }
    if (path.length > 0) {
        const lastNode = path[path.length - 1];
        const linkId = linkIds[node.id][lastNode.id];
        const linkElement = d3.select(`#${linkId}`);
        linkElement.selectAll(".link").style("stroke", "black").style("stroke-width", "5px");
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


// only for --dev
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
                const svg = d3.select("#tracking-area svg");
    
                // Remove previous graph if it exists
                svg.select("#graph-container").remove();
                const totalWeightDiv = document.querySelector(".total-weight");
                const accWeightDiv = document.querySelector(".acc-weight");
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