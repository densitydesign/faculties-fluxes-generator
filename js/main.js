const palette = {
    'prodotto': '#794099',
    'comunicazione': '#faa819',
    'interni': '#62ad60',
    'moda': '#d92b32',
    'pssd': '#f7de03',
    'dee': '#6c89a8'
}

Promise.all([
    d3.csv('data/flussi.csv', function(d) {
    return {
        laurea: d.laurea,
        source: d.source,
        target: d.target,
        value: +d.value
    };
}),
    d3.csv('data/voti.csv', function(d) {
    return {
        laurea: d.laurea,
        tipo: d.tipo,
        corso: d.corso,
        media: +d.media
    };
})
])
.then(([flussi, voti]) => {
    const datiTriennale = prepareData(flussi, 'triennale');
    const datiMagistrale = prepareData(flussi, 'magistrale');

    const votiTriennale = voti.filter(voto => voto.laurea == 'triennale' && voto.media > 0);
    const votiMagistrale = voti.filter(voto => voto.laurea == 'magistrale' && voto.media > 0);;

    // console.log(datiTriennale);
    // console.log(datiMagistrale);
    // console.log(votiTriennale,votiMagistrale);

    drawSankey(datiTriennale, '.viz__triennale');
    drawSankey(datiMagistrale, '.viz__magistrale');
    drawPlot(votiTriennale, '.viz__triennale');
    drawPlot(votiMagistrale, '.viz__magistrale');
});

function drawPlot(data, container) {
    const $refDimension = document.querySelector(container + ' .laureati').getBoundingClientRect();
    const width = 300;
    const height = $refDimension.height;

    const svg = d3.select(container + ' + .voti')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(
            d3.drag().on('drag', function() {
                    d3.select(this).attr('transform', 'translate(0' + ',' + (d3.event.y) + ')');
                })
            );

    const x = d3.scaleLinear()
        .domain([66, 110])
        .range([0, width]);
    const y = d3.scaleBand()
        .range([0, height]);

    if (container == '.viz__triennale') {
        y.domain(['interni', 'prodotto', 'comunicazione', 'moda']);
    } else {
        y.domain(['dee', 'pssd', 'interni', 'prodotto', 'comunicazione', 'moda']);
    }

    let binding = svg.selectAll('.media')
        .data(data)
        .enter();

    binding.append('rect')
            .classed('media', true)
            .attr('x', d => x(d.media))
            .attr('y', d => y(d.corso))
            .attr('width', 2)
            .attr('height', y.bandwidth())
            .style('fill', d => palette[d.corso]);

    binding.append('text')
            .classed('media', true)
            .classed('label', true)
            .attr('x', d => {
                if (d.tipo == 'entrata') {
                    return x(d.media) - 3;
                } else {
                    return x(d.media) + 5;
                }
            })
            .attr('y', d => y(d.corso) + y.bandwidth() / 2 + 2.5)
            .attr('text-anchor', d => d.tipo == 'entrata' ? 'end' : 'start')
            .text(d => d.media);
}

function drawSankey (data, container) {

    const margin = {top: 0, right: 0, bottom: 30, left: 0}
    const $containerDimension = document.querySelector(container).getBoundingClientRect();
    const width = $containerDimension.width - margin.left - margin.right;
    const height = $containerDimension.height - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');;

    const sankey = d3.sankey()
        .nodeId(d => d.name)
        .nodeWidth(15)
        .nodePadding(50)
        .extent([[1, 1], [width, height]]);

    let graph = sankey(data);

    let linksGroup = svg.append('g').selectAll('.link')
        .data(data.links)
        .enter()
        .append('path')
            .classed('link', true)
            .attr('d', d3.sankeyLinkHorizontal())
            .attr('stroke', d => {
                if (d.source.depth == 0) {
                    let school = d.source.name.includes('laureati triennale ') ? d.source.name.replace('laureati triennale ', '') : false;
                    if (school) {
                        return palette[school];
                    } else {
                        return '#eeeeee';
                    }
                } else {
                    return palette[d.source.name];
                }

            })
            .attr('stroke-width', d => Math.max(1, d.width));

    let nodesGroup = svg.append('g').selectAll('.step')
        .data(data.nodes)
        .enter()
        .append('g')
            .classed('step', true)
            .call(
                d3.drag()
                    .subject(function(d){return d})
                    .on('start', function () { this.parentNode.appendChild(this); })
                    .on('drag', dragmove)
                );

    nodesGroup.append('rect')
        .attr('class', d => d.name.replace(/\s/g, '-'))
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('height', d => d.y1 - d.y0)
        .attr('width', d => d.x1 - d.x0)
        .attr('fill', d => {
            if (palette[d.name]) {
                return palette[d.name];
            } else {
                return '#bcbec0';
            }
        });

    nodesGroup.append('text')
        .classed('label', true)
        .attr('x', d => d.depth < 2 ? d.x0 : d.x1)
        .attr('y', d => d.y1 + 14)
        .attr('text-anchor', d => d.depth < 2 ? 'start' : 'end')
        .style('font-weight', d => d.depth == 1 ? 900 : 400)
        .text(d => d.name);

    function dragmove(d) {
        let rectY = d3.select(this).select('rect').attr('y');

        d.y0 = d.y0 + d3.event.dy;

        let yTranslate = d.y0 - rectY;

        d3.select(this).attr('transform', 'translate(0' + ',' + (yTranslate) + ')');

        sankey.update(graph);
        linksGroup.attr('d',d3.sankeyLinkHorizontal());
    }
}

function prepareData (flussi, livello) {
    let links = flussi.filter(flusso => flusso.laurea == livello && flusso.value > 0).map(flusso => {
        return {
            source: flusso.source,
            target: flusso.target,
            value: flusso.value
        }
    });
    let nodes = [];

    links.forEach(function(link){
        let matchSource = nodes.findIndex(el => el.name == link.source);
        let matchTarget = nodes.findIndex(el => el.name == link.target);

        if (matchSource === -1) {
            nodes.push({name: link.source});
        }
        if (matchTarget === -1) {
            nodes.push({name: link.target});
        }
    });

    return { nodes: nodes, links: links};
}
