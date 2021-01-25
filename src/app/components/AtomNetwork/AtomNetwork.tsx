import React, {SyntheticEvent, useEffect, useState} from 'react';
import * as d3 from 'd3';
import makeRelationshipLinks from '../../utils/makeRelationshipLinks';
import {filteredSnapshot} from '../../../types';
interface NetworkProps {
  // filteredCurSnap is an object of atom or selector names as keys and 
  // an object as their value.
  filteredCurSnap: filteredSnapshot;
}

const Network: React.FC<NetworkProps> = ({filteredCurSnap}) => {
  // an array of atoms and selector sub
  let atomAndSelectorArr: [string, any][];
  filteredCurSnap ? atomAndSelectorArr = Object.entries(filteredCurSnap) : atomAndSelectorArr = [];
  // state hook for keeping the zoom consistent despite rerenders
  const [{x, y, k}, setZoomState] = useState({x: 0, y: 0, k: 0});

  // state hook for search value for atom network
  const [searchValue, setSearchValue] = useState('');

  //state hook for showing list of atoms
  const [showAtomMenu, setShowAtomMenu] = useState(false);
  // state hook for showing list of selectors
  const [showSelectorMenu, setShowSelectorMenu] = useState(false);
  // array of atom names (what the drop down showAtomMenu is going to display)
  const [atomList] = useState(atomAndSelectorArr.filter(([isAtom, obj])=> !obj.nodeDeps.length ? isAtom : null));
  // array of selectors (what the drop down showSelectorMenu is going to display)
  const [selectorList] = useState(atomAndSelectorArr.filter(([isSelector, obj]) => obj.nodeDeps.length ? isSelector : null));

  // function to handle change in search bar. Sets searchValue state
  const handleChange = (e: any) => {
    setSearchValue(e.target.value);
  };

  useEffect(() => {
    setZoomState(d3.zoomTransform(d3.select('#networkCanvas').node()));
  }, [filteredCurSnap]);

  useEffect(() => {
    // new filtered snap object to be constructed with search value
    const newFilteredCurSnap: any = {};

    // filters filteredCurSnap object with atoms and selectors that includes are search value
    const filter = (filteredCurSnap: filteredSnapshot) => {
      for (let key in filteredCurSnap) {
        if (key.toLowerCase().includes(searchValue.toLowerCase())) {
          newFilteredCurSnap[key] = filteredCurSnap[key];
          grabNodeToNodeSubscriptions(newFilteredCurSnap[key]);
          grabNodeDeps(newFilteredCurSnap[key]);
        }
      }
    };

    // helper functions to recursively include searched atoms/selectors' subscriptions
    const grabNodeToNodeSubscriptions = (node: any) => {
      let nodeSubscriptionLength = node.nodeToNodeSubscriptions.length;
      if (nodeSubscriptionLength > 0) {
        for (let i = 0; i < nodeSubscriptionLength; i += 1) {
          let currSN = node.nodeToNodeSubscriptions[i];
          newFilteredCurSnap[currSN] = filteredCurSnap[currSN];
          grabNodeToNodeSubscriptions(filteredCurSnap[currSN]);
        }
      }
    };
    const grabNodeDeps = (node: any) => {
      let nodeDepsLength = node.nodeDeps.length;
      if (nodeDepsLength > 0) {
        for (let i = 0; i < nodeDepsLength; i += 1) {
          let currDepNode = node.nodeDeps[i];
          newFilteredCurSnap[currDepNode] = filteredCurSnap[currDepNode];
          grabNodeDeps(filteredCurSnap[currDepNode]);
        }
      }
    };

    // invoke filter to populate newFilteredCurSnap
    filter(filteredCurSnap);
    document.getElementById('networkCanvas').innerHTML = '';

    let link: any;
    let node: any;
    let edgepaths: any;
    let edgelabels: any;

    const networkContainer = document.querySelector('.networkContainer');
    const width = networkContainer.clientWidth;
    const height = networkContainer.clientHeight;
    const svg = d3.select('#networkCanvas');

    const g = svg
      .append('g')
      .attr('transform', `translate(${x}, ${y}), scale(${k})`); // sets the canvas to the saved zoomState

    const markers = g
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 13)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#474747')
      .style('stroke', 'none');

    const simulation = d3
      .forceSimulation()
      .force(
        'link',
        d3
          .forceLink()
          .id(function (d: any) {
            return d.id;
          })
          .distance(100)
          .strength(1),
      )
      //make the nodes repel each other by assigning negative charge
      .force('charge', d3.forceManyBody().strength(-30))
      // .force('charge', d3.forceManyBody())
      .force('center', d3.forceCenter(width / 2, height / 2))
      //prevent the nodes from overlapping
      .force('collide',d3.forceCollide().radius(35).iterations(2));

    // snap will be newFilteredCurSnap if searchValue exists, if not original
    let snap: any = searchValue ? newFilteredCurSnap : filteredCurSnap;

    // TRANSFORM DATA INTO D3 SUPPORTED FORMAT FOR NETWORK GRAPH
    const networkData: any = makeRelationshipLinks(snap);
    // MAIN UPDATE CALL
    update(networkData.links, networkData.nodes);
    // HELPER FUNCTIONS BELOW FOR D3
    function update(links: any, nodes: any) {
      link = g
        .selectAll('.link')
        .data(links)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('marker-end', 'url(#arrowhead)');
      link.append('title').text(function (d: any) {
        return d.type;
      });
      edgepaths = g
        .selectAll('.edgepath')
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'edgepath')
        .attr('fill-opacity', '1.0')
        .attr('stroke-opacity', '1.0')
        .attr('id', function (d: any, i: any) {
          return 'edgepath' + i;
        })
        .style('pointer-events', 'none')
        .style('fill', '#474747')
        .style('stroke', '#474747')
        .style('stroke-width', '1px');
      edgelabels = g
        .selectAll('.edgelabel')
        .data(links)
        .enter()
        .append('text')
        .style('pointer-events', 'none')
        .attr('class', 'edgelabel')
        .attr('id', function (d: any, i: any) {
          return 'edgelabel' + i;
        })
        .attr('font-size', 10);
      edgelabels
        .append('textPath')
        .attr('xlink:href', function (d: any, i: any) {
          return '#edgepath' + i;
        })
        .style('text-anchor', 'middle')
        .style('pointer-events', 'none')
        .attr('startOffset', '50%')
        .text(function (d: any) {
          return d.type;
        });
      node = g
        .selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .call(
          d3
            .drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended),
        );
      node
        .append('circle')
        .attr('r', 5)
        .style('fill', function (d: any, i: any) {
          return d.name === 'Atom' ? '#9580FF' : '#FF80BF';
        });
      node.append('title').text(function (d: any) {
        return d.id;
      });
      node
        .append('text')
        .attr('dy', -3)
        .text(function (d: any) {
          return d.label;
        })
        .attr('fill', '#646464')
        .attr('stroke', 'none');
      simulation.nodes(nodes).on('tick', ticked);
      simulation.force('link').links(links);
    }
    function ticked() {
      link
        .attr('x1', function (d: any) {
          return d.source.x;
        })
        .attr('y1', function (d: any) {
          return d.source.y;
        })
        .attr('x2', function (d: any) {
          return d.target.x;
        })
        .attr('y2', function (d: any) {
          return d.target.y;
        });
      node.attr('transform', function (d: any) {
        return 'translate(' + d.x + ', ' + d.y + ')';
      });
      edgepaths.attr('d', function (d: any) {
        return (
          'M ' +
          d.source.x +
          ' ' +
          d.source.y +
          ' L ' +
          d.target.x +
          ' ' +
          d.target.y
        );
      });
      edgelabels.attr('transform', function (d: any) {
        if (d.target.x < d.source.x) {
          var bbox = this.getBBox();
          let rx = bbox.x + bbox.width / 2;
          let ry = bbox.y + bbox.height / 2;
          return 'rotate(180 ' + rx + ' ' + ry + ')';
        } else {
          return 'rotate(0)';
        }
      });
    }
    function dragstarted(d: any) {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(d: any) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }
    function dragended(d: any) {
      if (!d3.event.active) simulation.alphaTarget(0);
      d.fx = undefined;
      d.fy = undefined;
    }
    // allows the canvas to be draggable
    g.call(
      d3
        .drag()
        .on('start', dragStarted)
        .on('drag', draggedCanvas)
        .on('end', dragEnded),
    );
    // allows the canvas to be zoomable
    svg.call(
      d3
        .zoom()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0, 8])
        .on('zoom', zoomed),
    );
    // helper functions that help with dragging functionality
    function dragStarted() {
      d3.select(this).raise();
      g.attr('cursor', 'grabbing');
    }
    function draggedCanvas(d: any) {
      d3.select(this)
        .attr('dx', (d.x = d3.event.x))
        .attr('dy', (d.y = d3.event.y));
    }
    function dragEnded() {
      g.attr('cursor', 'grab');
    }
    // helper function that allows for zooming
    function zoomed() {
      g.attr('transform', d3.event.transform);
    }
  });//end of useEffect

  // handles clicking on Selector and Atom buttom to bring down
  // list of atoms or selects
  function openDropdown(e: React.MouseEvent) {
    // if user clicks on atom list button
    const target = e.target as Element;
    if(target.className === 'AtomP') {
      // check if selector list was previously open, if it is, close it
      if(showSelectorMenu) setShowSelectorMenu(false);
      // open atom list
      setShowAtomMenu(!showAtomMenu);
      // empty search box
      setSearchValue('');
    }
    // if user clicks on selector list button
    else if(target.className === 'SelectorP') {
      // check if atom list was previously open, if it is, close it
      if(showAtomMenu) setShowAtomMenu(false);
      // show Selector list
      setShowSelectorMenu(!showSelectorMenu);
      // empty search box
      setSearchValue('');
    }
  }

  return (
    <div className="networkContainer">
      <div className="Network">
        <svg data-testid="networkCanvas" id="networkCanvas"></svg>
      </div>
      <div className="LegendContainer">
        <div className="AtomNetworkLegend">
          <input
            id="networkSearch"
            type="text"
            placeholder="search for state"
            //check the input value to render corresponding and related nodes
            onChange={handleChange}
          />
          <div className="AtomDiv" 
            //change the visibility of the div depending the value of the state
            style={showSelectorMenu ? {opacity: '30%'} : {opacity: '100%'}} 
            onClick={openDropdown}>
            <div className="AtomLegend" />
            <p className="AtomP">ATOM</p>
          </div>

          <div className="SelectorDiv"
            //change the visibility of the div depending the value of the state
            style={showAtomMenu ? {opacity: '30%'} : {opacity: '100%'}} 
            onClick={openDropdown}>
            <div className="SelectorLegend"></div>
            <p className="SelectorP">SELECTOR</p>
          </div> 

          {/* conditional rendering of dropdowns depending on the value of the state */}
          {showAtomMenu &&
            <div className="AtomDropdown">{atomList.map(([atom, atomObj], i)=> {
              return (<p key={i} id={`Atom${i}`} className='AtomListItem' style={{opacity: '30%'}} onClick={(e: React.MouseEvent) => {
                //set the opacity to 30%, unless spefic element is clicked then changes it to 100%
                document.querySelector(`#Atom${i}`).setAttribute('style', 'opacity: 100%;');
                document.querySelectorAll('.AtomListItem').forEach(item => {
                  if(item.id !== `Atom${i}`) item.setAttribute('style', 'opacity: 30%;')
                });
                //set the search value to the name of the paragraph element to render only corresponding and related nodes
                setSearchValue((e.target as Element).innerHTML);
            }}>{atom}</p>)
          })}</div>}
          {showSelectorMenu &&
            <div className="SelectorDropdown">{selectorList.map(([selector, selectorObj], i) => {
              return (<p key={i} id={`Selector${i}`} className='SelectorListItem' style={{opacity: '30%'}} onClick={(e: React.MouseEvent) => {
                //set the opacity to 30%, unless specific element is clicked then changes it to 100%
                document.querySelector(`#Selector${i}`).setAttribute('style', 'opacity: 100%;');
                document.querySelectorAll('.SelectorListItem').forEach(item => {
                  if(item.id !== `Selector${i}`) item.setAttribute('style', 'opacity: 30%;')
                });
                //set the search value to the name of the paragraph element to render only corresponding and related nodes
                setSearchValue((e.target as Element).innerHTML);
            }}>{selector}</p>)
          })}</div>}
        </div>
      </div>
    </div>
  );
};

export default Network;
