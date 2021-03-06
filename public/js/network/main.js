require(['jquery', 'backbone', 'underscore',
    'renderers/network', 'util/progress', 'util/hud', 'util/viewport',
    'util/graph', 'network/nav', 'network/blurb', 'util/help', 'util/modal'],
    function (JQ, Backbone, _, NetworkVis, Progress, HUD, Viewport, Graph, Nav,
        Blurb, Help, Modal) {
        
    var neighborTemplate = _.template("/data/node/<%= id %>/neighbors");
    var networkTemplate  = _.template("/data/network/<%= id %>");
    var internalTemplate = _.template("/data/network/internal");
    var datasetsTemplate = _.template("/data/node/<%= id %>/datasets");
    var datasetLinkItemTemplate = _.template(
        "<li><a href=\"<%=link%>\" title=\"<%=desc%>\"><%=name%></a></li>");
    var neighborQueryTemplate = _.template("/data/query/network/neighbors");

    var App, Search, router, AppProgress;
    var resetNetwork = true;
    var clusters = [];
    var blurb, modal = new Modal();
        
    AppProgress = new Progress({
        element: "#progress-indicator",
        fade: false,
        type: Progress.BAR
    });
    var NetworkModel = Backbone.Model.extend({
        parse: function (data) { this.set(data); },
    });
    var NetworkData = new NetworkModel;
    var Datavis = new NetworkVis({
        element: JQ("#datavis"),
        dock: true,
        joinAttribute: "entityId",
        nodeLabel: { type: "CLUSTER" }
    });
    function setLayout() {
        JQ("#datavis").empty();
        var viewport = new Viewport({
            parent: "#datavis",
            title: "Network",
            maximize: false
        });
        Datavis.setElement(viewport);
        viewport.renderer(Datavis);
    }
    Datavis.on("dblclick-node", function (evt, node, element) {
        evt.stopPropagation();
        if (node.isExpanded) {
            Datavis.collapse(node);
            node.isExpanded = false;
            node.isCollapsed = true;
            return;
        } else if (node.isCollapsed) {
            Datavis.uncollapse(node);
            node.isCollapsed = false;
            node.isExpanded = true;
            return;
        }
        resetNetwork = false;
        if (DataSets.get('datasets') == null) {
            router.navigate("#node/" + node.entityId + "/datasets", true);
        } else {
            if (node.type == 'CLUSTER') {
                var docked = Datavis.dock.get();
                coNeighborAction([ node ], docked);
            } else {
                if (DataSets.asString() == 'fake') {
                    JQ.ajax({
                        url: neighborTemplate({ id: node.entityId }),
                        dataType: 'json',
                        data: { datasets: DataSets.asString() }
                    }).done(function (n) {
                        Datavis.merge(n);
                    });
            
                    // FIXME: This stopped working for some reason
                    //        Getting objects within edge.source/link
                    // router.navigate("#node/" + node.name + "/datasets/" +
                    //      DataSets.asString() +
                    //      "/neighbors", true);
                }
            }
        }
        node.isExpanded = true;
    });
    
    Datavis.on("click-node", function (evt, node, element) {
        Datavis.clickNode(node, element);
    });
    var nodeClusters = {};
    Datavis.addDockAction(function (nodes) {
        var dock = this;
        var button = JQ("<button>")
            .addClass("btn btn-sm btn-primary")
            .attr("id", "btn-get-clusters")
            .html("<i class=\"icon-plus-sign\"></i> Clusters");
        button.on("click", function () {
            AppProgress.progress(0);
            AppProgress.show("Getting clusters");
            var deferred = JQ.Deferred(), chained = deferred;
            var nodesDone = 0;
            function incProgress() {
                nodesDone++;
                AppProgress.progress(
                    nodesDone / nodes.length * 100 + "%");
            }
            nodes.forEach(function (node) {
                var entityId = node.entityId;
                chained = chained.then(function() {
                    if (nodeClusters[entityId]) {
                        incProgress();
                        return true;
                    }
                    var neighbors = new NetworkModel;
                    neighbors.url = neighborTemplate({ id: entityId });
                    var promise = JQ.Deferred();
                    neighbors.fetch({
                        data: {
                            datasets: DataSets.asString(),
                            rels: "gc" // GENE:CLUSTER
                        },
                        success: function(model, data) {
                            nodeClusters[entityId] = true;
                            incProgress();
                            if (!data) { promise.resolve(); return; }
                            data.nodes.forEach(function(node, ni) {
                                if (node.type == 'CLUSTER') {
                                    // Associate primary dataset with cluster
                                    var datasetIds = [];
                                    data.edges.forEach(function (edge) {
                                        if (ni == edge.source ||
                                            ni == edge.target) {
                                            datasetIds.push(edge.datasetId);
                                            node.group = edge.datasetId;
                                        }
                                    });
                                    if (datasetIds.length == 1) {
                                        node.dataset = _.find(data.datasets,
                                            function (d) {
                                                return d.id == datasetIds[0];
                                            });
                                    }
                                }
                            });
                            Datavis.merge(data);
                            promise.resolve();
                        }
                    })
                    return promise;
                });
            });
            chained.done(function () {
                AppProgress.dismiss();
                enableBuildNetwork();
            });
            deferred.resolve();
        })
        dock.hud.append(button);
    });
    var clusterNeighbors = {};
    Datavis.addDockAction(function (nodes) {
        var dock = this;
        var button = JQ("<button>").addClass("btn btn-sm")
            .attr("id", "btn-co-neighbors")
            .css("margin-left", 5)
            .attr("disabled", !clusters || clusters.length == 0)
            .html("<i class=\"icon-plus-sign\"></i> Co-Neighbors");
        dock.hud.append(button);
        button.on("click", function () { coNeighborAction(clusters, nodes) });
    });
    Datavis.addDockAction(function (nodes) {
        var dock = this;
        var button = JQ("<button>").addClass("btn btn-sm")
            .attr("id", "btn-co-neighbors")
            .css("margin-left", 5)
            .html("<i class=\"icon-external-link\"></i> Internal");
        dock.hud.append(button);
        button.on("click", function () { dockInternalNetwork(nodes) });
    })
    function coNeighborAction(clusters, dockedNodes) {
        AppProgress.progress(20); // Some width to indicate doing something
        AppProgress.show("Getting co-neighbors");
        var deferred = JQ.Deferred(),
            chained = deferred;
        var clustersDone = 0;
        var dockNeighbors = null;
        var dockFetch = fetchDockGeneNeighbors(dockedNodes)
            .done(function (response) { dockNeighbors = response; });
        var intersections = [];
        clusters.forEach(function (cluster) {
            chained = chained.then(function () {
                if (clusterNeighbors[cluster.entityId]) {
                    return true;
                }
                var codeferred = JQ.Deferred();
                var neighbors = new NetworkModel;
                neighbors.url = neighborTemplate({ id: cluster.entityId });
                neighbors.fetch({
                    data: { datasets: DataSets.asString() },
                    success: function (model, clusterNeighbors) {
                        clusterNeighbors[cluster.entityId] = true;
                        dockFetch.then(function () {
                            var ix = intersectNeighbors(
                                clusterNeighbors, dockNeighbors, dockedNodes
                            );
                            intersections.push(ix);
                            clustersDone++;
                            AppProgress.progress(clustersDone /
                                clusters.length * 100 + "%");
                            codeferred.resolve()
                        });
                    }
                });
                return codeferred;
            });
        });
        chained.done(function () {
            var NodeIndex = {}, DockIndex = {};
            dockedNodes.forEach(function (node, i) {
                DockIndex[node.entityId] = i;
            });
            var merged = {}, edges = {}, added = {};
            intersections.forEach(function (intersection) {
                if (!intersection.nodes) return;
                intersection.nodes.forEach(function (node) {
                    var id = node.entityId;
                    merged[id] = {
                        datasets: {},
                        edges: [],
                    };
                });
                intersection.edges.forEach(function (edge) {
                    edges[edge.id] = {};
                    ["source", "target"].forEach(function (side) {
                        var node = intersection.nodes[edge[side]];
                        edges[edge.id][side] = node;
                        // Don't tally datasets for docked nodes (not fair)
                        if (DockIndex[node.entityId] == null) {
                            merged[node.entityId].edges.push(edge);
                            merged[node.entityId].datasets[edge.datasetId] =
                                true;
                        }
                    });
                });
            });
            var added = {};
            var filtered = new Graph();
            function findAdd(node, edge) {
                var gnode = added[node.entityId];
                if (gnode == null) {
                    node.group = edge.datasetId;
                    gnode = filtered.addNode(node);
                    added[node.entityId] = gnode;
                }
                return gnode;
            }
            for (var nid in merged) {
                var ninfo = merged[nid];
                if (_.size(ninfo.datasets) > 1) {
                    ninfo.edges.forEach(function (edge) {
                        var source = findAdd(edges[edge.id].source, edge);
                        var target = findAdd(edges[edge.id].target, edge);
                        filtered.link(source, target, edge);
                    })
                }
            }
            Datavis.merge(filtered.json());
            AppProgress.dismiss();
            enableBuildNetwork();
            Datavis.render();
        });
        deferred.resolve();
    }
    function enableBuildNetwork() {
        clusters = Datavis.find("CLUSTER", "type");
        if (clusters.length) {
            JQ("#btn-co-neighbors").attr("disabled", false);
            showTable();
        }
    }
    
    function dockInternalNetwork(nodes) {
        modal.emptyBody();
        modal.show();
        var viewport = new Viewport({
            parent: modal.body(),
            id: "dock-internal",
            toolbar: false,
            title: "Internal Network",
            maximize: false,
        });
        viewport.css("min-height", 400)
        var progress = new Progress({ element: viewport });
        var progressDeferred = JQ.Deferred();
        setTimeout(function () {
            progress.show();
            progressDeferred.resolve();
        }, 1000);
        JQ.ajax({
            url: internalTemplate(),
            data: {
                nodes: _.pluck(nodes, "entityId").join(","),
                datasets: DataSets.asString()
            },
            dataType: "json",
        }).done(function (data) {
            setTimeout(function () {
                var Internal = new NetworkVis({
                    element: viewport,
                    dock: false,
                    nodeLabel: { type: "GENE" }
                });
                Internal.setData(data);
                Internal.render();
                viewport.renderer(Internal);
                progressDeferred.then(function () {
                    progress.dismiss();
                });
            }, 500);
        })
    }
    function showTable() {
        require(['renderers/table'], function (Table) {
                var div = JQ("<div>").attr("id", "cluster-list")
                .addClass("col-md-1 col-md-offset-2");
            JQ("#container").find("#cluster-list-row").remove();
            JQ("#container")
                .append(JQ("<div>").addClass("row")
                .attr("id", "cluster-list-row").append(div));
            var clusterFill = {};
            var table = new Table({
                element: "#cluster-list",
                scrollY: 100,
                rowCallback: function (row) {
                    JQ(this).css("background-color", clusterFill[row[1]]);
                    JQ(this).find("td").css("background-color",
                        clusterFill[row[1]]);
                }
            });
            var data = [];
            var dockedNodes = {};
            Datavis.dockedNodes().forEach(function (n) {
                dockedNodes[n.entityId] = true;
            });
            clusters.forEach(function (cluster) {
                var neighbors = Datavis.neighbors(cluster);
                var interactions = 0, source = "", networkType = "";
                neighbors.forEach(function (tuple) {
                    if (dockedNodes[tuple[0].entityId])
                        interactions++;
                })
                if (cluster.dataset) {
                    networkType = cluster.dataset.networkType;
                    source      = cluster.dataset.sourceReference;
                }
                clusterFill[cluster.entityId] =
                    Datavis.nodeProperty(cluster, "fill");
                var checkbox = "<input class=\"toggle-cluster\" " +
                    "type=\"checkbox\" checked data-cluster=\"" +
                    cluster.entityId + "\"></input>";
                data.push([
                    checkbox,
                    cluster.entityId,
                    cluster.name,
                    interactions,
                    networkType,
                    source
                ]);
            });
            data = _.sortBy(data, function (d) { return -d[3] });
            table.setData({
                columns: [
                    "<i class=\"icon-eye-open\"></i>", "KBase ID",
                    "Name", "Interactions", "Type", "Source"
                ],
                data: data
            });
            table.render({
                success: function () {
                    JQ(".toggle-cluster").click(function () {
                        if (this._hiddenNode) {
                            Datavis.unhideNode(this._hiddenNode);
                            delete this._hiddenNode;
                        } else {
                            var node = Datavis.findNode(
                                JQ(this).data("cluster"), "entityId");
                            node = Datavis.hideNode(node);
                            this._hiddenNode = node;
                        }
                    })
                }
            });
        })
    }
    function fetchDockGeneNeighbors(docked) {
        return JQ.ajax({
            url: neighborQueryTemplate(),
            dataType: "json",
            data: {
                nodes: _.pluck(docked, "entityId").join(","),
                datasets: DataSets.asString,
                rels: "gg"
            }
        });
    }
    function intersectNeighbors(neighbors1, neighbors2, anchors) {
        var addedAnchor = {};
        if (neighbors1.nodes == null || neighbors1.nodes.length == 0 ||
            neighbors2.nodes == null || neighbors2.nodes.length == 0)
            return {};
        var n1 = new Graph(neighbors1, Graph.INDEXED);
        var n2 = new Graph(neighbors2, Graph.INDEXED);
        var ix = new Graph();
        anchors.forEach(function (anchor) {
            var anchorNode = n2.findNode({ entityId: anchor.entityId });
            if (anchorNode == null) { return; }
            n1.eachNode(function (node) {
                var edge = n2.findEdge(
                    anchorNode, { entityId: node.get('entityId') }
                );
                if (edge) {
                    var ixanchor = addedAnchor[anchor.entityId];
                    if (ixanchor == null) {
                        var ixanchor = ix.addNode(anchorNode);
                        addedAnchor[anchor.entityId] = ixanchor;
                    }
                    var ixnode =
                        ix.findNode({ entityId: node.get('entityId') });
                    if (ixnode == null) {
                        ixnode = ix.addNode(node);
                    }
                    var nedge = ix.link(ixanchor, ixnode, edge.meta);
                }
            });
        });
        return ix.json();
    }
    
    var AppView = Backbone.View.extend({
        el: JQ("#container"),
        initialize: function () {
            _.bindAll(this, 'render');
            if (NetworkData != null)
                NetworkData.on('reset', this.render);
        },
        render: function () {
            var self = this;
            Datavis.merge(NetworkData.toJSON());
            AppProgress.dismiss();
            return self;
        },
    });
    
    var DataSetModel = Backbone.Model.extend({
        url:   function ()     { return datasetsTemplate(this); },
        parse: function (data) { this.set("datasets", data); }
    });
    var DataSets = new DataSetModel;
    DataSets.asString = function () {
        return DataSets.get("datasets").join(",")
    };
    
    var DataSetView = Backbone.View.extend({
        el: JQ("#container"),
        initialize: function () {
            _.bindAll(this, 'render');
            DataSets.on('change', this.render);
        },
        template: datasetLinkItemTemplate,
        render: function () {
            var self = this;
            var hud = new HUD({
                position: { top: 50, left: 20 },
                width: 400
            });
            var list = JQ("<ul>");
            if (DataSets == null ||
                    DataSets.get('datasets') == null) {
                hud.text("No datasets");
            } else {
                var datasets = DataSets.get('datasets');
                hud.append(JQ("<h4>").text("Data Sets"))
                hud.append(list);
                datasets.forEach(function (ds) {
                    list.append(self.template({
                        name: ds.name, desc: ds.description,
                        link: "#node/" + DataSets.get('id') + 
                              "/datasets/" + ds.id
                    }));
                })
                list.append(self.template({
                    name: 'All', desc: "Use all networks",
                    link: "#node/" + DataSets.get('id') +
                        "/datasets/" + _.pluck(datasets, 'id').join(',')
                }))
            }
            hud.show();
        }
    })
    
    function resetData() {
        JQ("#cluster-list").remove();
        Datavis.reset();
        NetworkData.clear({ silent: true });
    }
    
    var SearchBox = Backbone.View.extend({
        el: JQ("#nav-search"),
        events: { "submit": "search" },
        search: function (data) {
            var query = JQ("#nav-search [type=text]").val();
            resetNetwork = false;
            router.navigate("#node/" + query, true);
        }
    });
    
    var navbar = new Nav({ el: "#nav-content" });

    function showApp(params) {
        if (params.id == 'fake') {
            DataSets.set('datasets', ["fake"]);
        }
        NetworkData.url = params.url({ id: params.id });
        App = new AppView;
        NetworkData.fetch({
            data: params.fetchData,
            success: function () {
                App.render();
            }
        });
    }
    
    search = new SearchBox;
    var Router = Backbone.Router.extend({
        routes: {
            "node/:id":                          "addNode",
            "node/:id/datasets/:sets":           "addNode",
            "nodes/:nodes/datasets/:sets":       "addNodes",
            "node/:node/datasets":               "networkDatasets",
            "node/:id/datasets/:sets/neighbors": "neighborhood",
            "network/:nodes/datasets/:sets":     "internalNetwork",
            ":network":                          "showNetwork",
            "*path":                             "default"
        },
        addNode: function (nodeId, datasets) {
            if (resetNetwork) { resetData(); }
            NetworkData.set({ id: nodeId });
            Datavis.addNode({ name: nodeId });
            DataSets.set('datasets', datasets.split(","));
        },
        addNodes: function (nodeInput, datasetInput) {
            if (blurb) {
                blurb.fadeOut(function () { JQ(this).remove(); });
                setLayout();
            }
            setLayout();
            resetData();
            var nodes = decodeURIComponent(nodeInput).split(",");
            var datasets = decodeURIComponent(datasetInput).split(",");
            for (var i = 0; i < nodes.length; i++) {
                var type, group;
                type = 'GENE';
                group = 'genes';
                Datavis.addNode({
                    name: nodes[i], entityId: nodes[i], type: type, group: group
                });
            }
            DataSets.set('datasets', datasets);
            Datavis.render();
            Datavis.dockNodes(nodes);
            Datavis.dock.showHUD();
        },
        showNetwork: function (networkId) {
            resetData();
            showApp({
                id: networkId || 'fake',
                url: networkTemplate
            })
        },
        networkDatasets: function (nodeId) {
            DataSets.set({ id: nodeId });
            var datasetView = new DataSetView();
            DataSets.fetch({
                success: function () { AppProgress.dismiss(); }
            });
        },
        neighborhood: function (id, datasets) {
            showApp({
                id: id,
                url: neighborTemplate,
                fetchData: { datasets: datasets }
            });
            DataSets.set('datasets', datasets.split(","));
        },
        internalNetwork: function (nodes, datasets) {
            AppProgress.show("Building");
            showApp({
                id: "internal",
                url: internalTemplate,
                fetchData: { datasets: datasets, nodes: nodes }
            });
        },
        default: function () {
            JQ("#datavis").empty();
            JQ("#cluster-list").remove();
            blurb = new Blurb({ parent: "#datavis", router: router });
        }
    });
    router = new Router;
    Backbone.history.start();
    var help = new Help({
        template: "/templates/network-help.html",
        title: "Using the Network Workbench"
    });
    modal.init();
});