// Spatial Waves controller for canvas-based client positioning and wave triggering
export class SpatialController {
    constructor(websocketController, uiController, clientManager, chordController) {
        this.websocketController = websocketController;
        this.uiController = uiController;
        this.clientManager = clientManager;
        this.chordController = chordController;
        
        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        
        // Wave system
        this.waves = [];
        this.animationId = null;
        this.isAnimating = false;
        
        // Client positions in canvas coordinates
        this.clientPositions = new Map(); // clientId -> {x, y}
        this.selectedClient = null;
        this.isDragging = false;
        this.dragOffset = {x: 0, y: 0};
        
        // Settings
        this.waveSpeed = 2; // pixels per frame
        this.waveRadius = 5; // initial radius
        this.clientRadius = 20; // client hit radius
        
        // Fixed wave origin
        this.fixedOrigin = null; // {x, y} or null for mouse origin
        
        // Current chord settings
        this.currentKey = 'C';
        this.currentScale = 'major';
        this.currentChord = 1; // 1-7 for scale degrees
        
        // Chord assignments for keys 1-7 (maps key number to chord degree)
        this.chordAssignments = {
            1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7
        };
        
        console.log('SpatialController initialized');
    }
    
    // Initialize the spatial controller
    initialize() {
        if (this.isInitialized) return;
        
        this.canvas = document.getElementById('spatialCanvas');
        if (!this.canvas) {
            console.error('Spatial canvas not found!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.setupEventListeners();
        this.startAnimation();
        
        this.isInitialized = true;
        console.log('Spatial canvas initialized');
        
        // Initialize with current clients
        this.updateClientPositions();
    }
    
    // Setup canvas properties
    setupCanvas() {
        // Set canvas size
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Set styles for responsiveness
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.height = 'auto';
        
        console.log(`Canvas setup: ${this.canvas.width}x${this.canvas.height}`);
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Mouse events for canvas interaction
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        
        // Keyboard events for chord triggering
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Client updates
        this.websocketController.onClientUpdate(() => {
            this.updateClientPositions();
        });
        
        // UI control event listeners
        this.setupUIControls();
        
        console.log('Spatial event listeners setup');
    }
    
    // Setup UI control event listeners
    setupUIControls() {
        // Arrangement buttons
        const arrangeCircleButton = document.getElementById('arrangeCircleButton');
        const arrangeLineButton = document.getElementById('arrangeLineButton');
        const clearFixedOriginButton = document.getElementById('clearFixedOriginButton');
        
        if (arrangeCircleButton) {
            arrangeCircleButton.addEventListener('click', () => {
                this.arrangeClientsInCircle();
            });
        }
        
        if (arrangeLineButton) {
            arrangeLineButton.addEventListener('click', () => {
                this.arrangeClientsInLine();
            });
        }
        
        if (clearFixedOriginButton) {
            clearFixedOriginButton.addEventListener('click', () => {
                this.fixedOrigin = null;
                this.uiController.logMessage('Fixed origin cleared');
            });
        }
        
        // Musical settings
        const spatialKey = document.getElementById('spatialKey');
        const spatialScale = document.getElementById('spatialScale');
        const waveSpeed = document.getElementById('waveSpeed');
        const waveSpeedValue = document.getElementById('waveSpeedValue');
        
        if (spatialKey) {
            spatialKey.addEventListener('change', (e) => {
                this.currentKey = e.target.value;
                this.updateChordControllerSettings();
            });
        }
        
        if (spatialScale) {
            spatialScale.addEventListener('change', (e) => {
                this.currentScale = e.target.value;
                this.updateChordControllerSettings();
            });
        }
        
        if (waveSpeed && waveSpeedValue) {
            waveSpeed.addEventListener('input', (e) => {
                this.waveSpeed = parseFloat(e.target.value);
                waveSpeedValue.textContent = this.waveSpeed.toFixed(1);
            });
            // Initialize display
            waveSpeedValue.textContent = this.waveSpeed.toFixed(1);
        }
        
        // Chord assignment controls
        this.setupChordAssignmentUI();
        
        // Reset chord assignments button
        const resetChordAssignments = document.getElementById('resetChordAssignments');
        if (resetChordAssignments) {
            resetChordAssignments.addEventListener('click', () => {
                this.resetChordAssignments();
            });
        }
        
        console.log('Spatial UI controls setup');
    }
    
    // Setup chord assignment UI
    setupChordAssignmentUI() {
        const container = document.getElementById('chordAssignmentGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Create assignment controls for keys 1-7
        for (let keyNum = 1; keyNum <= 7; keyNum++) {
            const keyContainer = document.createElement('div');
            keyContainer.style.cssText = 'text-align: center; padding: 10px; background-color: #f5f5f5; border-radius: 6px;';
            
            const keyLabel = document.createElement('div');
            keyLabel.textContent = `Key ${keyNum}`;
            keyLabel.style.cssText = 'font-weight: bold; margin-bottom: 5px; color: #333;';
            
            const chordSelect = document.createElement('select');
            chordSelect.id = `chordAssign${keyNum}`;
            chordSelect.style.cssText = 'width: 100%; padding: 4px; font-size: 12px;';
            
            // Populate with chord degree options
            const maxDegrees = this.getMaxDegrees();
            for (let degree = 1; degree <= maxDegrees; degree++) {
                const option = document.createElement('option');
                option.value = degree;
                option.textContent = this.getChordName(degree);
                if (degree === this.chordAssignments[keyNum]) {
                    option.selected = true;
                }
                chordSelect.appendChild(option);
            }
            
            // Add event listener
            chordSelect.addEventListener('change', (e) => {
                this.chordAssignments[keyNum] = parseInt(e.target.value);
                console.log(`Key ${keyNum} assigned to chord degree ${e.target.value}`);
            });
            
            keyContainer.appendChild(keyLabel);
            keyContainer.appendChild(chordSelect);
            container.appendChild(keyContainer);
        }
    }
    
    // Get maximum degrees for current scale
    getMaxDegrees() {
        if (!this.chordController || !this.chordController.scales[this.currentScale]) {
            return 7;
        }
        return this.chordController.scales[this.currentScale].length;
    }
    
    // Get chord name for a degree
    getChordName(degree) {
        if (!this.chordController) {
            return `${degree}`;
        }
        
        // Try to get chord info to determine major/minor/diminished
        const chord = this.chordController.getChordForDegree(this.currentKey, this.currentScale, degree);
        if (chord) {
            const symbols = {
                'major': '',
                'minor': 'm',
                'diminished': '°',
                'augmented': '+'
            };
            const symbol = symbols[chord.chordType] || '';
            return `${degree}${symbol}`;
        }
        
        return `${degree}`;
    }
    
    // Reset chord assignments to default scale degrees
    resetChordAssignments() {
        const maxDegrees = this.getMaxDegrees();
        for (let i = 1; i <= 7; i++) {
            this.chordAssignments[i] = i <= maxDegrees ? i : 1;
        }
        this.setupChordAssignmentUI();
        this.uiController.logMessage('Chord assignments reset to scale degrees');
    }
    
    // Update chord controller settings when spatial settings change
    updateChordControllerSettings() {
        if (this.chordController && this.chordController.setMusicalParameters) {
            this.chordController.setMusicalParameters(this.currentKey, this.currentScale);
        }
        
        // Regenerate chord assignment UI with new key/scale
        this.resetChordAssignments();
        
        console.log(`Spatial waves updated to ${this.currentKey} ${this.currentScale}`);
    }
    
    // Handle mouse down for dragging clients
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        // Check if clicking on a client
        const clickedClient = this.getClientAtPosition(x, y);
        if (clickedClient) {
            this.selectedClient = clickedClient.id;
            this.isDragging = true;
            const pos = this.clientPositions.get(clickedClient.id);
            this.dragOffset = {
                x: x - pos.x,
                y: y - pos.y
            };
            e.preventDefault();
        }
    }
    
    // Handle mouse move for dragging
    handleMouseMove(e) {
        if (!this.isDragging || !this.selectedClient) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        // Update client position
        const newPos = {
            x: Math.max(this.clientRadius, Math.min(this.canvas.width - this.clientRadius, x - this.dragOffset.x)),
            y: Math.max(this.clientRadius, Math.min(this.canvas.height - this.clientRadius, y - this.dragOffset.y))
        };
        
        this.clientPositions.set(this.selectedClient, newPos);
        e.preventDefault();
    }
    
    // Handle mouse up to end dragging
    handleMouseUp(e) {
        this.isDragging = false;
        this.selectedClient = null;
        this.dragOffset = {x: 0, y: 0};
    }
    
    // Handle canvas click for wave triggering
    handleCanvasClick(e) {
        if (this.isDragging) return; // Don't trigger waves while dragging
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        // Don't trigger wave if clicking on a client
        if (this.getClientAtPosition(x, y)) return;
        
        // Trigger wave from click position or fixed origin
        const origin = this.fixedOrigin || {x, y};
        this.triggerWave(origin.x, origin.y);
    }
    
    // Handle keyboard input for chord triggering
    handleKeyDown(e) {
        // Only handle if in spatial section
        if (this.uiController.getCurrentSection() !== 'spatial') return;
        
        const key = e.key;
        if (key >= '1' && key <= '7') {
            const keyNumber = parseInt(key);
            const chordDegree = this.chordAssignments[keyNumber] || keyNumber;
            this.currentChord = chordDegree;
            
            // Trigger wave from fixed origin or canvas center
            const origin = this.fixedOrigin || {
                x: this.canvas.width / 2,
                y: this.canvas.height / 2
            };
            
            this.triggerWave(origin.x, origin.y, chordDegree);
            e.preventDefault();
        }
        
        // Set fixed origin with 'F' key
        if (key === 'f' || key === 'F') {
            if (this.fixedOrigin) {
                this.fixedOrigin = null;
                this.uiController.logMessage('Fixed origin cleared - waves will follow mouse');
            } else {
                this.fixedOrigin = {
                    x: this.canvas.width / 2,
                    y: this.canvas.height / 2
                };
                this.uiController.logMessage('Fixed origin set at canvas center');
            }
            e.preventDefault();
        }
    }
    
    // Get client at specific position
    getClientAtPosition(x, y) {
        const clients = this.websocketController.getClients();
        
        for (const client of clients) {
            const pos = this.clientPositions.get(client.id);
            if (!pos) continue;
            
            const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
            if (distance <= this.clientRadius) {
                return client;
            }
        }
        
        return null;
    }
    
    // Update client positions when clients change
    updateClientPositions() {
        const clients = this.websocketController.getClients();
        
        // Remove positions for disconnected clients
        const currentClientIds = new Set(clients.map(c => c.id));
        for (const [clientId] of this.clientPositions) {
            if (!currentClientIds.has(clientId)) {
                this.clientPositions.delete(clientId);
            }
        }
        
        // Add positions for new clients
        clients.forEach((client, index) => {
            if (!this.clientPositions.has(client.id)) {
                // Position new clients in a circle by default
                const angle = (index / clients.length) * 2 * Math.PI;
                const centerX = this.canvas.width / 2;
                const centerY = this.canvas.height / 2;
                const radius = Math.min(this.canvas.width, this.canvas.height) * 0.3;
                
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                
                this.clientPositions.set(client.id, {x, y});
            }
        });
        
        console.log(`Updated positions for ${clients.length} clients`);
    }
    
    // Trigger a wave from specified position
    triggerWave(x, y, chordDegree = null) {
        const wave = {
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            radius: this.waveRadius,
            maxRadius: Math.max(this.canvas.width, this.canvas.height) * 1.5,
            speed: this.waveSpeed,
            chordDegree: chordDegree || this.currentChord,
            triggeredClients: new Set(),
            alpha: 1.0
        };
        
        this.waves.push(wave);
        
        const chordText = chordDegree ? ` (chord ${chordDegree})` : '';
        console.log(`Wave triggered at (${Math.round(x)}, ${Math.round(y)})${chordText}`);
    }
    
    // Start animation loop
    startAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.animate();
    }
    
    // Stop animation loop
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isAnimating = false;
    }
    
    // Animation loop
    animate() {
        if (!this.isAnimating) return;
        
        this.updateWaves();
        this.draw();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    // Update wave physics
    updateWaves() {
        this.waves = this.waves.filter(wave => {
            // Expand wave
            wave.radius += wave.speed;
            
            // Fade out as wave expands
            wave.alpha = Math.max(0, 1 - (wave.radius / wave.maxRadius));
            
            // Check collision with clients
            this.checkWaveCollisions(wave);
            
            // Remove wave if it's too large or faded
            return wave.radius < wave.maxRadius && wave.alpha > 0.01;
        });
    }
    
    // Check wave collisions with clients
    checkWaveCollisions(wave) {
        const clients = this.websocketController.getClients();
        
        clients.forEach(client => {
            if (wave.triggeredClients.has(client.id)) return;
            
            const pos = this.clientPositions.get(client.id);
            if (!pos) return;
            
            const distance = Math.sqrt((wave.x - pos.x) ** 2 + (wave.y - pos.y) ** 2);
            
            // Check if wave edge is hitting client
            if (Math.abs(distance - wave.radius) < this.clientRadius) {
                wave.triggeredClients.add(client.id);
                this.triggerClientNote(client.id, wave.chordDegree);
            }
        });
    }
    
    // Trigger note on specific client - distributes chord tones among clients
    triggerClientNote(clientId, chordDegree) {
        if (!this.chordController) {
            // Fallback to simple sine wave
            this.websocketController.triggerSound([clientId], 'sine');
            return;
        }
        
        // Get the full chord for this degree
        const chord = this.chordController.getChordForDegree(
            this.currentKey,
            this.currentScale,
            chordDegree
        );
        
        if (chord && chord.tones) {
            // Get all connected clients to determine chord tone distribution
            const clients = this.websocketController.getClients();
            const clientIndex = clients.findIndex(c => c.id === clientId);
            
            if (clientIndex === -1) {
                console.warn('Client not found for chord assignment');
                return;
            }
            
            // Distribute chord tones cyclically among clients
            const chordToneIndex = clientIndex % chord.tones.length;
            const chordTone = chord.tones[chordToneIndex];
            
            this.websocketController.triggerSound([clientId], 'sine', chordTone.frequency);
            
            const shortId = clientId.substring(0, 8).toUpperCase();
            const intervalNames = ['Root', '3rd', '5th', '7th', '9th', '11th', '13th'];
            const intervalName = intervalNames[chordToneIndex] || `+${chordTone.interval}`;
            console.log(`Triggered ${chordTone.name} (${intervalName}, ${chordTone.frequency}Hz) on client ${shortId}`);
        } else {
            // Fallback to root note
            const note = this.chordController.getNoteForChordDegree(
                this.currentKey,
                this.currentScale,
                chordDegree
            );
            
            if (note) {
                this.websocketController.triggerSound([clientId], 'sine', note.frequency);
                const shortId = clientId.substring(0, 8).toUpperCase();
                console.log(`Triggered ${note.name} (Root, ${note.frequency}Hz) on client ${shortId}`);
            } else {
                this.websocketController.triggerSound([clientId], 'sine');
            }
        }
    }
    
    // Draw everything on canvas
    draw() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background grid
        this.drawGrid();
        
        // Draw fixed origin if set
        if (this.fixedOrigin) {
            this.drawFixedOrigin();
        }
        
        // Draw clients
        this.drawClients();
        
        // Draw waves
        this.drawWaves();
        
        // Draw UI overlay
        this.drawUIOverlay();
    }
    
    // Draw background grid
    drawGrid() {
        const gridSize = 100; // Larger, less frequent grid
        
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.1; // Much more subtle
        
        // Vertical lines - every other one
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines - every other one
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1.0;
    }
    
    // Draw fixed origin marker
    drawFixedOrigin() {
        const {x, y} = this.fixedOrigin;
        
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.strokeStyle = '#ff4757';
        this.ctx.lineWidth = 2;
        
        // Draw cross
        this.ctx.beginPath();
        this.ctx.moveTo(x - 10, y);
        this.ctx.lineTo(x + 10, y);
        this.ctx.moveTo(x, y - 10);
        this.ctx.lineTo(x, y + 10);
        this.ctx.stroke();
        
        // Draw circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
        this.ctx.stroke();
    }
    
    // Draw clients as circles
    drawClients() {
        const clients = this.websocketController.getClients();
        
        clients.forEach((client, index) => {
            const pos = this.clientPositions.get(client.id);
            if (!pos) return;
            
            const isSelected = this.selectedClient === client.id;
            
            // Client circle
            this.ctx.fillStyle = isSelected ? '#4CAF50' : '#2196F3';
            this.ctx.strokeStyle = isSelected ? '#45a049' : '#1976D2';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, this.clientRadius, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Client ID text
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            const shortId = client.id.substring(0, 4).toUpperCase();
            this.ctx.fillText(shortId, pos.x, pos.y);
            
            // Client number
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(`#${index + 1}`, pos.x, pos.y + 15);
        });
    }
    
    // Draw waves as expanding circles
    drawWaves() {
        this.waves.forEach(wave => {
            this.ctx.strokeStyle = `rgba(76, 175, 80, ${wave.alpha})`;
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = wave.alpha;
            
            this.ctx.beginPath();
            this.ctx.arc(wave.x, wave.y, wave.radius, 0, 2 * Math.PI);
            this.ctx.stroke();
            
            this.ctx.globalAlpha = 1.0;
        });
    }
    
    // Draw UI overlay with instructions
    drawUIOverlay() {
        const padding = 10;
        const lineHeight = 16;
        let y = padding + lineHeight;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(padding, padding, 300, 120);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        const instructions = [
            'Instructions:',
            '• Click to trigger waves',
            '• Drag clients to reposition',
            '• Keys 1-7: Trigger chord degrees',
            '• F: Toggle fixed origin',
            `Current chord: ${this.currentChord} in ${this.currentKey} ${this.currentScale}`,
            `Fixed origin: ${this.fixedOrigin ? 'ON' : 'OFF'}`
        ];
        
        instructions.forEach((text, index) => {
            this.ctx.fillText(text, padding + 5, y + (index * lineHeight));
        });
    }
    
    // Auto-position clients in a circle
    arrangeClientsInCircle() {
        const clients = this.websocketController.getClients();
        if (clients.length === 0) return;
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) * 0.3;
        
        clients.forEach((client, index) => {
            const angle = (index / clients.length) * 2 * Math.PI;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            this.clientPositions.set(client.id, {x, y});
        });
        
        this.uiController.logMessage(`Arranged ${clients.length} clients in a circle`);
    }
    
    // Auto-position clients in a line
    arrangeClientsInLine() {
        const clients = this.websocketController.getClients();
        if (clients.length === 0) return;
        
        const startX = this.clientRadius + 20;
        const endX = this.canvas.width - this.clientRadius - 20;
        const y = this.canvas.height / 2;
        
        clients.forEach((client, index) => {
            const progress = clients.length > 1 ? index / (clients.length - 1) : 0;
            const x = startX + (endX - startX) * progress;
            
            this.clientPositions.set(client.id, {x, y});
        });
        
        this.uiController.logMessage(`Arranged ${clients.length} clients in a line`);
    }
    
    // Set musical parameters
    setMusicalParameters(key, scale) {
        this.currentKey = key;
        this.currentScale = scale;
        console.log(`Spatial waves: ${key} ${scale}`);
    }
    
    // Destroy the controller
    destroy() {
        this.stopAnimation();
        
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
            this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
            this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
            this.canvas.removeEventListener('click', this.handleCanvasClick.bind(this));
        }
        
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        
        this.isInitialized = false;
        console.log('SpatialController destroyed');
    }
}