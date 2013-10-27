var container, stats;

var camera, scene, renderer;

var mesh;

/**
 * The graph of all topics
 * @type {Array}
 */
var topicsGraph = [];

/**
 * The currently displayed graph
 * @type {Array}
 */
var displayedGraph = topicsGraph;
/**
 * A collection of the particle systems that make up the scene
 */
var particleSystems;
/**
 * A collection of colliders that map to the verts in displayedGraph
 */
var colliders;

var projector = new THREE.Projector();

jQuery(window).ready(function() {
    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

    jQuery.ajax({
        dataType: "text",
        url: "topics.rsf.lay",
        success: function(topicData) {
            var lines = topicData.split("\n");
            for (var lineIndex = 0, lineCount = lines.length; lineIndex < lineCount; ++lineIndex) {
                if (lines[lineIndex].lenth != 0 && lines[lineIndex].substr(0, 1) != "#") {
                    var topicDetails = lines[lineIndex].split("\t");
                    if (topicDetails.length == 8) {
                        topicsGraph.push({
                            id: topicDetails[5],
                            x: Number(topicDetails[1]),
                            y: Number(topicDetails[2]),
                            z: Number(topicDetails[3]),
                            size: Number(topicDetails[4]),
                            groupingProperty: "products",   // The property in the database that identifies the various groups this vert belongs to
                            database: null                  // The database that is used to look up additional data relating to this vert
                        });
                    }
                }
            }

            init();
            animate();
        }
    });
});

function init() {

    container = document.getElementById( 'container' );

    camera = new THREE.PerspectiveCamera( 27, window.innerWidth / window.innerHeight, 5, 100000 );
    camera.position.z = 7500;

    scene = new THREE.Scene();

    uniforms = {

        amplitude: { type: "f", value: 1.0 },
        color:     { type: "c", value: new THREE.Color( 0xffffff ) },
        texture:   { type: "t", value: THREE.ImageUtils.loadTexture( "particle.png" ) }

    };

    renderer = new THREE.WebGLRenderer( { antialias: false, clearColor: 0x333333, clearAlpha: 1, alpha: false } );
    /*renderer = Detector.webgl ?
     new THREE.WebGLRenderer({ antialias: false, clearColor: 0x333333, clearAlpha: 1, alpha: false }):
     new THREE.CanvasRenderer({ antialias: false, clearColor: 0x333333, clearAlpha: 1, alpha: false });*/
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor( 0, 1 );

    container.appendChild( renderer.domElement );

    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'mousemove', mouseMove, false );

    setupControls();
    createParticles();
}

function setupControls() {
    controls = new THREE.TrackballControls( camera );

    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    controls.noZoom = false;
    controls.noPan = false;

    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.3;

    controls.keys = [ 65, 83, 68 ];

    controls.addEventListener( 'change', render );
}

function onWindowResize() {

    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {

    requestAnimationFrame( animate );
    controls.update();
    render();
}

function render() {
    listProductsInFrustum();
    renderer.render( scene, camera );
}

function mouseMove(event) {
    var mouse2D = new THREE.Vector2(0, 0);
    var mouse3D = new THREE.Vector3(0, 0, 0);

    mouse3D.x = mouse2D.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse3D.y = mouse2D.y = -(event.clientY / window.innerHeight) * 2 + 1;
    mouse3D.z = 0.5;

    projector.unprojectVector( mouse3D, camera );
    var ray = new THREE.Ray( camera.position, mouse3D.sub( camera.position ).normalize() );

    var collisions = [];
    for (var collidersIndex = 0, collidersCount = colliders.length; collidersIndex < collidersCount; ++collidersIndex) {
        var collisionSphere = colliders[collidersIndex];
        if (ray.isIntersectionSphere(collisionSphere)) {
            collisions.push(collisionSphere);
        }
    }

    var closestCollision;
    var closestCollisionDist;
    for (var collisionsIndex = 0, collisionsCount = collisions.length; collisionsIndex < collisionsCount; ++collisionsIndex) {
        var distToCamera = collisions[collisionsIndex].distanceToPoint(camera.position);
        if (!closestCollision || closestCollisionDist > distToCamera) {
            closestCollisionDist = distToCamera;
            closestCollision = collisions[collisionsIndex];
        }
    }

    if (closestCollision) {
        var selected = document.getElementById("selected");
        if (selected) {
            selected.parentNode.removeChild(selected);
        }

        selected = document.createElement("div");
        selected.className = "selected";
        selected.id = "selected";
        var selectedText = "Topic ID: " + closestCollision.topic.id;

        selected.innerHTML = selectedText;
        document.body.appendChild(selected);
    }
}

function createParticles() {
    var particleCount = displayedGraph.length;

    // Reset the colliders
    colliders = [];

    particleSystems = [];
    var maxZ;

    // Loop over the topics, create a new particle system for every 10000
    // particles.
    var maxVerts = 10000;
    for (var vertexIndex = 0; vertexIndex < particleCount; vertexIndex += maxVerts) {
        (function() {
            var attributes = {
                size: {	type: 'f', value: [] },
                customColor: { type: 'c', value: [] }
            };

            var shaderMaterial = new THREE.ShaderMaterial( {
                uniforms: 		uniforms,
                attributes:     attributes,
                vertexShader:   document.getElementById( 'vertexshader' ).textContent,
                fragmentShader: document.getElementById( 'fragmentshader' ).textContent,

                blending: 		THREE.AdditiveBlending,
                depthTest: 		false,
                transparent:	true
            });

            // create the particle variables
            var particles = new THREE.Geometry();
            var values_size = attributes.size.value;
            var values_color = attributes.customColor.value;

            // now create the individual particles
            //for(var p = 0; p < particleCount; p++) {
            for (var p = vertexIndex; p < (vertexIndex + maxVerts < particleCount ? vertexIndex + maxVerts : particleCount); ++p) {

                var pX = displayedGraph[p].x,
                    pY = displayedGraph[p].y,
                    pZ = displayedGraph[p].z,
                    particle = new THREE.Vector3(pX, pY, pZ);

                values_size[ p % maxVerts ] = 50;// + (10 * displayedTopics[p].size);

                var sphereCollider = new THREE.Sphere(particle, 10);
                sphereCollider.particle = particle;
                sphereCollider.topic = displayedGraph[p];
                colliders.push(sphereCollider);

                values_color[ p % maxVerts ] = new THREE.Color();
                values_color[ p % maxVerts ].setRGB(32, 32, 32);

                // add it to the geometry
                particles.vertices.push(particle);
            }

            particles.computeBoundingSphere();
            if (maxZ == null || maxZ < particles.boundingSphere.radius) {
                maxZ = particles.boundingSphere.radius;
            }

            // create the particle system
            var particleSystem =
                new THREE.ParticleSystem(
                    particles,
                    shaderMaterial);

            particleSystems.push(particleSystem);

            // add it to the scene
            scene.add(particleSystem);
        })();
    }

    controls.position0.x = controls.position0.y = 0;
    controls.position0.z = maxZ * 5;
    controls.reset();
}