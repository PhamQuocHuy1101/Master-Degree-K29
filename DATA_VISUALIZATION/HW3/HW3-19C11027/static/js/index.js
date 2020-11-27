var width = 750;
var height = 750;
var data;
var __zoneData;
var __filterData = [];
var __enableZone = false;
var __riskCategory = 'All';
var __riskCategoryOpts = ['All', 'Low Risk', 'Moderate Risk', 'High Risk'];
const defaultScoreRange = [0, 100];
var __scoreRange = [0, 100];
var __startDate = null;
var __endDate = null;
var __detail = {};

var circlePos = [{
    id: 1,
    x: 50,
    y: 50,
    radius: 20
}, {
    id: 2,
    x: 100,
    y: 50,
    radius: 20
}];
var projection = d3.geoMercator()
    .center([-122.433701, 37.767683])
    .scale(225000)
    .translate([width / 2, height / 2]);
var color = d3.scaleSequential(d3.schemeSet2).domain([0, 1]);
var dispatch = d3.dispatch("load", "selectZone", "filter", "reset", "detail");

async function init() {
    data = await d3.csv("../static/data/restaurant_scores.csv");
    __filterData = data;
}

function drawCircle(radius) {
    var path = d3.path();
    path.arc(0, 0, radius, 0, Math.PI * 2);
    return path;
}

function filterData() {
    let fData = [];
    if (__enableZone) {
        const includeZone = (x, y) => {
            let res = true;
            circlePos.forEach(pos => {
                let dx = (x - pos.x);
                let dy = (y - pos.y);
                res = res && Math.sqrt(dx * dx + dy * dy) <= pos.radius + 0.1;
            })
            return res;
        }

        fData = data.filter(d => {
            let [x, y] = projection([d.business_longitude, d.business_latitude]);
            return includeZone(x, y)
        })
    } else {
        fData = data;
    }

    let startDate = new Date(__startDate);
    let endDate = new Date(__endDate);
    __filterData = fData.filter(d => {
        let check = __riskCategory == 'All' || d.risk_category == __riskCategory;
        check = check && (__scoreRange[0] <= d.inspection_score && d.inspection_score <= __scoreRange[1]);
        let date = new Date(d.inspection_date)
        check = check && (startDate <= date && date <= endDate);
        return check;
    })
    return __filterData;
};

dispatch.on('load.map', function renderMap() {
    var drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    var dragRadius = d3.drag()
        .on("start", dragRadiusStarted)
        .on("drag", draggedRadius)
        .on("end", dragRadiusEnded)
    var svg = d3.select("#sanMap").append("svg")
        .attr("viewBox", [0, 0, 1000, 1000])
        .attr("stroke-width", 2);

    var sanMap = svg.append('g')
        .append("image")
        .attr("width", width)
        .attr("height", height)
        .attr("xlink:href", "../static/data/sf-map.svg");

    var resLoc = svg.selectAll('g.resLoc')
        .call(renderLocation, data);


    dispatch.on('selectZone', function() {
        if (__enableZone) {
            svg.selectAll("g.dragCircle")
                .data(circlePos)
                .join("g")
                .attr('class', 'dragCircle')
                .attr("clip-path", d => d.id)
                .append('g')
                .attr("transform", d => `translate(${d.x},${d.y})`)
                .call(g =>
                    g.append("path")
                    .attr("class", 'zone')
                    .attr("d", d => drawCircle(d.radius))
                    .attr("fill", color(Math.random()))
                    .attr('stroke', '#69b3a2')
                    .attr('stroke-width', '1px')
                    .attr("fill-opacity", 0.1)
                    .call(dragRadius)
                )
                .call(g =>
                    g.append('circle')
                    .attr('r', '3')
                    .attr("fill", "transparent")
                    .attr('stroke', '#69b3a2')
                    .attr('stroke-width', '1px')
                )
                .call(drag)
        } else {
            svg.selectAll("g.dragCircle").remove();
        }
    });
    dispatch.on('filter.apply', function() {
        svg.selectAll('g.resLoc').remove();
        svg.selectAll('g.resLoc').call(renderLocation, filterData());
        dispatch.call("detail", this);
    })

    dispatch.on("reset.apply", function() {
        __filterData = data;
        svg.selectAll('g.resLoc').remove();
        svg.selectAll('g.resLoc').call(renderLocation, data);
    })

    function dragstarted(event, d) {
        d3.select(this).raise();
    }

    function dragged(event, d) {
        d.x = event.x
        d.y = event.y
        d3.select(this).attr("transform", `translate(${event.x},${event.y})`)
    }

    function dragended(event, d) {
        d3.select(this).attr("stroke", null).attr("fill", "blue");
    }

    function dragRadiusStarted(event, d) {
        d3.select(this).attr("d", drawCircle(20))
        d.radius = 20;
    }

    function draggedRadius(event, d) {
        let dx = event.x - d.x;
        let dy = event.y - d.y;
        let radius = Math.sqrt(dx * dx + dy * dy);
        radius = radius > 20 ? radius : 20;
        d3.select(this).attr("d", drawCircle(radius));
        d.radius = radius;
    }

    function dragRadiusEnded(event, d) {
        return;
    }

    function renderLocation(selection, locations) {
        selection.data(locations)
            .join('g')
            .attr("transform", function(d) {
                return `translate(${projection([d.business_longitude, d.business_latitude]).join(',')})`
            })
            .attr('class', 'resLoc')
            .on("click", selectRes)
            .append('circle')
            .attr("r", 2)
            .attr("fill", "blue")
            .attr('stroke', 'white')
            .attr('stroke-width', 0.2)
            .append("title")
            .text(d => `${d.business_name}`)
    };

    function selectRes(event, d) {
        d3.selectAll('g.resLoc').selectAll('circle').attr('fill', 'blue');
        d3.selectAll('g.resLoc').selectAll('image').remove();

        if (__detail.business_id != d.business_id) {
            __detail = {...d };
            dispatch.call("detail", this)
        }
    }

});

dispatch.on('load.selectZone', function setupZone() {
    var btnSelect = d3.select("#selectZoneBtn").text(__enableZone ? 'Hide zone' : 'Show zone');
    btnSelect.on("click", function(event) {
        __enableZone = !__enableZone;
        btnSelect.text(__enableZone ? 'Hide zone' : 'Show zone')
        dispatch.call('selectZone', this)
    })

    var btnApply = d3.select("#applyBtnZone");
    btnApply.on('click', function() {
        dispatch.call("filter", this)
    })
})
dispatch.on('load.risk', function createFilter() {
    //risk_category 
    var seltRisk = d3.select("#riskCategory")
        .on('change', function() {
            __riskCategory = this.value;
            dispatch.call("filter", this)
        })

    seltRisk.selectAll("option")
        .data(__riskCategoryOpts)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

    dispatch.on("reset.risk", function() {
        __riskCategory = 'All';
        seltRisk.property("value", __riskCategory);
    })
})

dispatch.on('load.score', function() {
    // inspection_score
    var sliderRange = d3
        .sliderBottom()
        .min(0)
        .max(100)
        .width(300)
        .step(10)
        .ticks(10)
        .default(defaultScoreRange)
        .fill('#2196f3')
        .on('end', val => {
            __scoreRange = val;
            dispatch.call("filter", this)
        });

    var gRange = d3
        .select('div#inspectionScore')
        .append('svg')
        .attr('width', 360)
        .attr('height', 80)
        .append('g')
        .attr('transform', 'translate(30,30)');

    gRange.call(sliderRange);

    dispatch.on("reset.score", function() {
        __scoreRange = defaultScoreRange;
        sliderRange.value(defaultScoreRange);
    })
});

dispatch.on("load.date", function() {
    //inspection_date
    let minDate = d3.min(data.map(el => new Date(el.inspection_date)))
    let maxDate = d3.max(data.map(el => new Date(el.inspection_date)));
    const formatDate = date => {
        let m = date.getMonth() < 9 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
        let d = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();

        return `${date.getFullYear()}-${m}-${d}`;
    }
    __startDate = formatDate(minDate);
    __endDate = formatDate(maxDate);
    var start = d3.select('#startDate')
        .attr('value', __startDate)
        .attr('min', __startDate)
        .attr('max', __endDate)
        .on('change', function() {
            __startDate = this.value;
            dispatch.call("filter", this)
        })
    var end = d3.select('#endDate')
        .attr('value', __endDate)
        .attr('min', __startDate)
        .attr('max', __endDate)
        .on('change', function() {
            __endDate = this.value;
            dispatch.call("filter", this)
        })
    dispatch.on('reset.date', function() {
        __startDate = formatDate(minDate);
        __endDate = formatDate(maxDate);
        start.property('value', __startDate);
        end.property('value', __endDate);
    })
})

dispatch.on("load.resetFilter", function() {
    d3.select("#btnResetFilter")
        .on("click", function() {
            dispatch.call("reset", this)
        })
});

dispatch.on('detail', function() {
    let current = __filterData.filter(el => el.business_id == __detail.business_id);
    __detail = current.length > 0 ? current[0] : {};
    if (__detail.business_id) {
        d3.select('.detail')
            .style('display', 'block');
        d3.select('#detail')
            .html(
                `<div class="name">${__detail.business_name}</div>
            <div class="address">${__detail.business_address}</div>
            <div class="item">
                <div> Phone </div>
                <div class="content"> (${__detail.business_postal_code}) ${__detail.business_phone_number} </div>
            </div>
            <div class="item">
                <div> Risk Category</div>
                <div class="content">${__detail.risk_category} </div>
            </div>
            <div class="complain">${__detail.violation_description}</div>
        `
            )

        d3.select('#sanMap').selectAll('svg')
            .append('g')
            .attr('id', 'locIcon')
            .attr("transform", `translate(${projection([__detail.business_longitude, __detail.business_latitude]).join(',')})`)
            .append('image')
            .attr("transform", "translate(-10,-20)")
            .attr("width", "20px")
            .attr("height", "20px")
            .attr("xlink:href", "../static/data/placeholder.svg");
    } else {
        d3.selectAll('#locIcon').remove();
        d3.select('.detail')
            .style('display', 'none');
    }
})
async function start() {
    await init();
    dispatch.call('load', this);
}

start();