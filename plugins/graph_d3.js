
var max_weight = 10
var min_weight = 1


function createFullyConnectedGraph(numNodes) {
    width = 1024;
    height = 768;
    // var arc = d3.arc();
    var svg = d3.select("#tracking-area")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
    // var arc = d3.arc().innerRadius(10).outerRadius(20).startAngle(0).endAngle(Math.PI * 2);
    // svg.append("path").attr("d", arc).attr("transform", "translate(100, 100)").attr("fill", "steelblue");
    
    // numNodes = 12;
    const centerX = width / 2;
    const centerY = height / 2;
    margin = 50;
    const radius = width < height ? width / 2 - margin : height / 2 - margin;
    // Generate nodes with random positions
    const nodes = d3.range(numNodes).map((d, i) => ({
        id: i,
        x: centerX + radius * Math.cos(2 * Math.PI * i / numNodes), // Adjust for button width
        y: centerY + radius * Math.sin(2 * Math.PI * i / numNodes) // Adjust for button height
    }));
    const node_radius = 60;
    nodes.forEach(node => {
        const group = svg.append("g");
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
            .on("click", function(){console.log("clicked node ", node.id);});
        group.append("text")
            .attr("class", "node_text")
            .attr("x", node.x)
            .attr("y", node.y)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .text(node.id + 1)
            .attr("fill", "black")
            .style("pointer-events", "none");
        group.select("text")
            .style("font-size", "30pt");

    })
                      
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
    var weights_iter = (function*() {
        for (let i = 0; i < links.length; i++){
            yield weights[i];
        }
    })();

    var weight_offset = 0.25;
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
        const group = svg.append("g")
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
            .text(weights_iter.next().value)
            .attr("fill", "black")
            .attr("font-size", "20pt")
            .attr("pointer-events", "none");

    })
}


// Call the function to create the graph
// $(document).ready(function () {
createFullyConnectedGraph(6); // Change the number to create more nodes
// });
