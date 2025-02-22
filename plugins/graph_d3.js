
max_weight = 10;
min_weight = 1;
acc_weights = 0;

numNodes = 4;

path = [];
path_links = [];
graph = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));
return_graph = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));

const trackingArea = document.getElementById("tracking-area");
const nodeLabels = [['L', 'Living Room'], ['K', 'Kitchen'], ['B', 'Bathroom'], ['F', 'Front Porch'], ['A', 'Attic'], ['O', 'Office']];
// const legend = document.createElement("table");
// legend.style.position = "absolute";


function createFullyConnectedGraph() {
    const width = 1024;
    const height = 768;
    // var arc = d3.arc();
    const svg = d3.select("#tracking-area")
    .select("svg")  // Try to select the SVG
    .empty()        // Check if the selection is empty
    ? d3.select("#tracking-area").append("svg")  // Append a new SVG if empty
    : d3.select("#tracking-area svg");           // Otherwise, use the existing one

    svg.attr("width", width)
    .attr("height", height);
    // var arc = d3.arc().innerRadius(10).outerRadius(20).startAngle(0).endAngle(Math.PI * 2);
    // svg.append("path").attr("d", arc).attr("transform", "translate(100, 100)").attr("fill", "steelblue");
    // svg.select("#graph-container").remove()
    const container = svg.append("g")
    .attr("id", "graph-container");
    // numNodes = 12;
    const centerX = width / 2;
    const centerY = height / 2;
    const margin = 70;
    const radius = width < height ? width / 2 - margin : height / 2 - margin;
    // Generate nodes with random positions
    const nodes = d3.range(numNodes).map((d, i) => ({
        id: i,
        x: centerX + radius * Math.cos(2 * Math.PI * i / numNodes), // Adjust for button width
        y: centerY + radius * Math.sin(2 * Math.PI * i / numNodes) // Adjust for button height
    }));
    const node_radius = 60;
    nodes.forEach(node => {
        const group = container.append("g");
        let node_label = nodeLabels[node.id][0];
        group.append("circle")
            .attr("class", "node")
            .attr("id", node.id)
            .attr("cx", node.x)
            .attr("cy", node.y)
            .attr("r", node_radius)
            .attr("fill", "white")
            .attr("stroke", "black")
            .on("mouseover", function() {this.style.fill = "gray";
            this.parentNode.querySelector("text").style.fill = "white";
            })
            .on("mouseout", function(){
                this.style.fill = "white";
                this.parentNode.querySelector("text").style.fill = "black";
            })
            .on("click", function() {
                clickNode(node);
            });
        group.append("text")
            .attr("class", "node_text")
            .attr("x", node.x)
            .attr("y", node.y)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            // .text(node.id + 1)
            .text(node_label)
            .attr("fill", "black")
            .style("pointer-events", "none");
        group.select("text")
            .style("font-size", "30pt");

    })
    
    updateLegend(numNodes);
    const legend = document.getElementById("legend");
    const legendWidth = legend.offsetWidth;
    legend.style.right = `${margin - legendWidth}px`;



    // Generate links (fully connected)
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                    links.push({ source: nodes[i], target: nodes[j] });
                }
            }

    // Calculate weights----
    var total_weight = Math.ceil((max_weight + min_weight) * links.length / 2);
    var weights = [];
    var current_weight_sum = 0;
    for (let i = 0; i<links.length; i++){
        var target_mean = Math.min(max_weight, Math.max(min_weight, Math.floor((total_weight - current_weight_sum) / (links.length - i))));
        var std = Math.min(max_weight - target_mean, target_mean - min_weight);
        var current_min_weight = target_mean - Math.ceil(std * ((links.length - i - 1) / links.length));
        var current_max_weight = target_mean + Math.ceil(std * ((links.length - i - 1) / links.length));
        // var current_max_weight = Math.min(Math.floor((total_weight - current_weight_sum) / (links.length - i)) * 2, max_weight);
        // var current_min_weight = Math.max(min_weight, (total_weight - current_weight_sum) - (current_max_weight * (links.length - i - 1)));
        var w = Math.floor(Math.random() * (current_max_weight - current_min_weight + 1)) + current_min_weight;
        current_weight_sum += w;
        weights.push(w);
    }

    var weight_offset = 0.303;
    var line_gap_size = 20;
    links.forEach((link, index) => {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;

        const x1 = link.source.x + unitX * node_radius;
        const y1 = link.source.y + unitY * node_radius;
        const x2 = link.target.x - unitX * node_radius;
        const y2 = link.target.y - unitY * node_radius;
        const center_weight_x = (x1+x2)/2;
        const center_weight_y = (y1+y2)/2;
        const mid_distance = radius * Math.cos(Math.PI / numNodes);
        const offset_value = mid_distance - Math.sqrt((centerX - center_weight_x)**2 + (centerY - center_weight_y)**2);
        const weight_x = center_weight_x + unitX * weight_offset * offset_value;
        // const weight_y = (y1 + y2) / 2 + (index % 2 === 0 ? -10 : 10); // Adjusted y coordinate to be symmetric and non-overlapping
        const weight_y = center_weight_y + unitY * weight_offset * offset_value;
        // const next_weight = weights_iter.next().value;
        const linkId = "link" + index;
        const group = container.append("g")
            .attr("id", linkId);
        group.append("line")
            .attr("class", "link")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", weight_x - line_gap_size * unitX)
            .attr("y2", weight_y - line_gap_size * unitY)
            .attr("stroke", "black");
        group.append("line")
            .attr("class", "link")
            .attr("x1", weight_x + line_gap_size * unitX)
            .attr("y1", weight_y + line_gap_size * unitY)
            .attr("x2", x2)
            .attr("y2", y2)
            .attr("stroke", "black");
        group.append("text")
            .attr("class", "edge_weight")
            .attr("x", weight_x)
            .attr("y", weight_y)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .text(weights[index])
            .attr("fill", "black")
            .attr("font-size", "20pt");

        graph[link.source.id][link.target.id]=linkId;
        graph[link.target.id][link.source.id]=linkId;
        return_graph[link.source.id][link.target.id]=weights[index];
        return_graph[link.target.id][link.source.id]=weights[index];
        


    })
    var total_edge_weight = 0;
    for (let w of weights) {
        total_edge_weight += w;
    }
    // const trackingArea = document.getElementById("tracking-area");

    // Removed for less information on the screen

    // const totalWeightDiv = document.createElement("div");
    // totalWeightDiv.className = "total-weight";
    // totalWeightDiv.style.position = "absolute";
    // totalWeightDiv.style.left = "20px";
    // totalWeightDiv.style.top = "20px";
    // totalWeightDiv.textContent = "Total Edge Weight: " + total_edge_weight;
    // totalWeightDiv.style.fontSize = "20px";


    const accWeightsDiv = document.createElement("div");
    accWeightsDiv.className = "acc-weight";
    accWeightsDiv.style.position = "absolute";
    accWeightsDiv.style.left = "20px";
    accWeightsDiv.style.top = "80px"; // updated y position to avoid overlap
    accWeightsDiv.textContent = "\u{1FA99}: " + acc_weights;
    accWeightsDiv.style.fontSize = "30px";



    // trackingArea.appendChild(totalWeightDiv);
    trackingArea.appendChild(accWeightsDiv);

    socket.emit("message_command",
        {
            "command": {
                "event": "save_graph",
                "graph": return_graph
            },
            "room": self_room,
            "user_id": self_user
        }
    )
    pushNode(nodes[0]);
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
    return nodes;
}

function updateLegend(numRows) {
    // Get or create the table element
    let table = document.getElementById("legend");
    if (!table) {
        table = document.createElement("table");
        table.id = "legend";
        table.style.position = "absolute";
        table.style.top = "50px";
        // table.style.right = "-50px";
        trackingArea.appendChild(table);
    }
    
    // Clear existing table content
    table.innerHTML = "";

    // Create table header
    // let thead = document.createElement("thead");
    // let headerRow = document.createElement("tr");
    
    // let th1 = document.createElement("th");
    // th1.textContent = "Legend";
    // let th2 = document.createElement("th"); // Empty second header
    
    // headerRow.appendChild(th1);
    // headerRow.appendChild(th2);
    // thead.appendChild(headerRow);
    // table.appendChild(thead);

    // Create table body and populate with node labels
    let tbody = document.createElement("tbody");
    
    nodeLabels.slice(0, numRows).forEach(([label, name]) => {
        let row = document.createElement("tr");
        
        let td1 = document.createElement("td");
        td1.style.textAlign = "left";
        td1.style.fontSize = "30px";
        td1.style.fontWeight = "bold";
        td1.style.padding = "5px 20px"
        td1.textContent = label;
        let td2 = document.createElement("td");
        td2.style.textAlign = "left";
        td2.style.fontSize = "30px";
        td2.style.padding = "10px 20px"
        td2.textContent = name;
        
        row.appendChild(td1);
        row.appendChild(td2);
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
}


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
                resetNodeGray(clickedNode);
                path.pop();
                last_link_id = path_links.pop();
                const linkElement = d3.select(`#${last_link_id}`);
                resetLink(linkElement);
                makeNodeNewOut(path[path.length - 1]);
            }
            else{
                while (path_links.length > i){
                    last_link_id = path_links.pop();
                    const linkElement = d3.select(`#${last_link_id}`);
                    resetLink(linkElement);
                }
                // let j = path.length - 1;
                while (path.length > i + 1){
                    node = path.pop();
                    resetNodeWhite(node);
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
        const linkId = graph[clickedNode.id][last_node.id];
        const linkElement = d3.select(`#${linkId}`);

        path_links.push(linkId)
        makeNodeOld(last_node);
        pushNode(clickedNode);
        colorLinkVisited(linkElement);

        if (path.length === numNodes){
            const linkId = graph[clickedNode.id][path[0].id];
            const linkElement = d3.select(`#${linkId}`);
            colorLinkVisited(linkElement);
            path_links.push(linkId);
        }
        updateWeights();
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
    for (const linkId of path_links){
        // const node_s = path[i];
        // const node_e = path[i+1];
        // const linkId = graph[node_s.id][node_e.id];
        const linkElement = d3.select(`#${linkId}`);
        acc_weights += parseInt(linkElement.select("text").text(), 10);
    }
    const accWeigthDiv = document.querySelector(".acc-weight");
    accWeigthDiv.textContent = "\u{1FA99}: " + acc_weights;
}

function pushNode(node){
    path.push(node);
    makeNodeNew(node);
}
function makeNodeNew(node){
    const nodeElement = document.getElementById(node.id);
    // nodeElement.setAttribute("fill", "green");
    nodeElement.style.fill = "lightgreen";
    nodeElement.onmouseover = function() { this.style.fill = "green"; };
    nodeElement.onmouseout = function() { this.style.fill = "lightgreen"; };
}
function makeNodeNewOut(node){
    const nodeElement = document.getElementById(node.id);
    // nodeElement.setAttribute("fill", "green");
    nodeElement.style.fill = "lightgreen";
    nodeElement.onmouseover = function() { this.style.fill = "green"; };
    nodeElement.onmouseout = function() { this.style.fill = "lightgreen"; };
}
function makeNodeOld(node){
    const nodeElement = document.getElementById(node.id);
    nodeElement.style.fill = "orange";
    nodeElement.onmouseover = function() { 
        this.style.fill = "#F08C00";
        nodeElement.parentNode.querySelector("text").style.fill = "white";
    };
    
    nodeElement.onmouseout = function() {
        this.style.fill = "orange";
        nodeElement.parentNode.querySelector("text").style.fill = "black";
    };
}
function resetNodeWhite(node){
    const nodeElement = document.getElementById(node.id);
    // nodeElement.setAttribute("fill", "green");
    nodeElement.style.fill = "white";
    nodeElement.onmouseover = function() {
        this.style.fill = "gray";
    };
    nodeElement.onmouseout = function() { this.style.fill = "white"; };
}
function resetNodeGray(node){
    const nodeElement = document.getElementById(node.id);
    // nodeElement.setAttribute("fill", "green");
    nodeElement.style.fill = "gray";
    nodeElement.onmouseover = function() {
        this.style.fill = "gray";
    };
    nodeElement.onmouseout = function() { this.style.fill = "white"; };
}

function colorLinkVisited(link){
    link.selectAll(".link").style("stroke", "orange").style("stroke-width", "4px");
}
function colorLinkAccepting(link){
    link.selectAll(".link").style("stroke", "lightgreen").style("stroke-width", "4px");
}
function resetLink(link){
    link.selectAll(".link").style("stroke", "black").style("stroke-width", "1px");
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
// socket.emit("message_command",
//     {
//         "text_message": {
//             "event": "board_logging",
//             "board": objects_board
//         },
//         "room": self_room
//     }
// )
// Call the function to create the graph
// $(document).ready(function () {
// nodes = createFullyConnectedGraph(); // Change the number to create more nodes
// });
$(document).ready(
    socket.on("command", (data) => {
        if (typeof(data.command === 'object')){
            if (data.command.event == "new_episode"){
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

                // Reset Variables
                path = [];
                path_links = [];
                graph = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));
                return_graph = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));

                createFullyConnectedGraph();
            }
        }
    })
)
