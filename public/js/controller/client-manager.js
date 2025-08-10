// Client management controller for Echo Mesh
export class ClientManager {
    constructor(websocketController, uiController) {
        this.websocketController = websocketController;
        this.uiController = uiController;
        
        // Client state
        this.clients = [];
        this.clientGroups = new Map();
        this.unassignedClients = new Set();
        this.clientPitches = new Map();
        this.clientPositions = new Map();
        this.soloMode = false;
        
        // DOM elements
        this.elements = {
            clientCount: document.getElementById('clientCount'),
            clientsGrid: document.getElementById('clients-grid'),
            clientCountStatus: document.getElementById('clientCountStatus')
        };
        
        this.setupMessageHandlers();
    }
    
    // Set up WebSocket message handlers
    setupMessageHandlers() {
        this.websocketController.onMessage('clientConnected', (data) => {
            this.handleClientConnected(data);
        });
        
        this.websocketController.onMessage('clientDisconnected', (data) => {
            this.handleClientDisconnected(data);
        });
        
        this.websocketController.onMessage('clients', (data) => {
            this.handleClientsUpdate(data);
        });
    }
    
    // Handle client connected
    handleClientConnected(data) {
        this.uiController.logMessage(`Client ${data.id} connected`);
        this.addClient(data.id);
    }
    
    // Handle client disconnected
    handleClientDisconnected(data) {
        this.uiController.logMessage(`Client ${data.id} disconnected`);
        this.removeClient(data.id);
    }
    
    // Handle clients list update
    handleClientsUpdate(data) {
        if (data.clients) {
            this.updateClientList(data.clients);
        }
    }
    
    // Add a client
    addClient(clientId) {
        if (!this.clients.includes(clientId)) {
            this.clients.push(clientId);
            this.updateClientCount();
            
            // Add to unassigned clients for grouping system
            this.unassignedClients.add(clientId);
            
            // Initialize default pitch settings
            if (!this.clientPitches.has(clientId)) {
                const frequency = this.generateFrequencyForClient(clientId);
                this.clientPitches.set(clientId, {
                    frequency: frequency,
                    octave: 4,
                    note: this.frequencyToNote(frequency)
                });
            }
            
            this.addClientElement(clientId);
            this.uiController.logMessage(`Client ${clientId.substring(0, 8)} added`);
        }
    }
    
    // Remove a client
    removeClient(clientId) {
        const index = this.clients.indexOf(clientId);
        if (index !== -1) {
            this.clients.splice(index, 1);
            this.updateClientCount();
            
            // Remove from grouping system
            this.removeClientFromAllGroups(clientId);
            this.unassignedClients.delete(clientId);
            
            // Clean up client data
            this.clientPitches.delete(clientId);
            this.clientPositions.delete(clientId);
            
            this.updateClientList(this.clients);
            this.uiController.logMessage(`Client ${clientId.substring(0, 8)} removed`);
        }
    }
    
    // Update client list
    updateClientList(newClients) {
        console.log('updateClientList called with:', newClients);
        this.clients = newClients || [];
        this.updateClientCount();
        
        // Clear existing client display
        if (this.elements.clientsGrid) {
            this.elements.clientsGrid.innerHTML = '';
        }
        
        if (this.clients.length === 0) {
            this.addNoClientsCard();
        } else {
            // Add each client
            this.clients.forEach(clientId => {
                this.addClientElement(clientId);
            });
        }
        
        this.uiController.logMessage(`Updated client list: ${this.clients.length} clients`);
    }
    
    // Add "no clients" card
    addNoClientsCard() {
        if (!this.elements.clientsGrid) return;
        
        const noClientsCard = document.createElement('div');
        noClientsCard.className = 'client-card';
        noClientsCard.innerHTML = `
            <div class="client-id">No clients</div>
            <p>No clients are currently connected</p>
        `;
        this.elements.clientsGrid.appendChild(noClientsCard);
    }
    
    // Add client element to UI
    addClientElement(clientId) {
        if (!this.elements.clientsGrid) return;
        
        const shortId = clientId.substring(0, 8).toUpperCase();
        const clientCard = document.createElement('div');
        clientCard.className = 'client-card';
        clientCard.innerHTML = `
            <div class="client-id">${shortId}</div>
            <p>Connected</p>
            <button class="button sound" data-client="${clientId}" data-sound="sine">Sine</button>
            <button class="button sound" data-client="${clientId}" data-sound="square">Square</button>
            <button class="button sound" data-client="${clientId}" data-sound="sawtooth">Sawtooth</button>
            <button class="button sound" data-client="${clientId}" data-sound="triangle">Triangle</button>
        `;
        
        // Add event listeners to sound buttons
        clientCard.querySelectorAll('.button.sound').forEach(button => {
            button.addEventListener('click', () => {
                const clientId = button.getAttribute('data-client');
                const sound = button.getAttribute('data-sound');
                this.triggerClientSound(clientId, sound);
            });
        });
        
        this.elements.clientsGrid.appendChild(clientCard);
    }
    
    // Update client count display
    updateClientCount() {
        const count = this.clients.length;
        
        if (this.elements.clientCount) {
            this.elements.clientCount.textContent = count.toString();
        }
        
        if (this.elements.clientCountStatus) {
            this.elements.clientCountStatus.textContent = count.toString();
        }
    }
    
    // Trigger sound on specific client
    triggerClientSound(clientId, sound) {
        this.websocketController.triggerSound([clientId], sound);
        const shortId = clientId.substring(0, 8).toUpperCase();
        this.uiController.logMessage(`Playing ${sound} on client ${shortId}`);
    }
    
    // Generate frequency for client based on ID
    generateFrequencyForClient(clientId) {
        // Simple pentatonic scale assignment based on client ID hash
        const pentatonicSteps = [0, 2, 4, 7, 9]; // C major pentatonic
        const hash = clientId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const step = pentatonicSteps[hash % pentatonicSteps.length];
        return 220 * Math.pow(2, step / 12); // Base frequency A3
    }
    
    // Convert frequency to note name
    frequencyToNote(frequency) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const A4 = 440;
        const semitone = Math.round(12 * Math.log2(frequency / A4)) + 9; // A4 = 9th semitone
        return notes[((semitone % 12) + 12) % 12];
    }
    
    // Group management
    createGroup(name, type = 'custom') {
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const group = {
            id: groupId,
            name: name,
            type: type,
            clients: new Set(),
            muted: false,
            solo: false,
            volume: 1.0
        };
        
        this.clientGroups.set(groupId, group);
        this.uiController.logMessage(`Created group: ${name}`);
        return groupId;
    }
    
    // Add client to group
    addClientToGroup(clientId, groupId) {
        this.removeClientFromAllGroups(clientId);
        
        const group = this.clientGroups.get(groupId);
        if (group) {
            group.clients.add(clientId);
            this.unassignedClients.delete(clientId);
            this.uiController.logMessage(`Moved client ${clientId.substring(0, 8)} to ${group.name}`);
        }
    }
    
    // Remove client from all groups
    removeClientFromAllGroups(clientId) {
        for (const group of this.clientGroups.values()) {
            if (group.clients.has(clientId)) {
                group.clients.delete(clientId);
            }
        }
        this.unassignedClients.add(clientId);
    }
    
    // Delete group
    deleteGroup(groupId) {
        const group = this.clientGroups.get(groupId);
        if (group) {
            // Move all clients back to unassigned
            for (const clientId of group.clients) {
                this.unassignedClients.add(clientId);
            }
            this.clientGroups.delete(groupId);
            this.uiController.logMessage(`Deleted group: ${group.name}`);
        }
    }
    
    // Toggle group mute
    toggleGroupMute(groupId) {
        const group = this.clientGroups.get(groupId);
        if (group) {
            group.muted = !group.muted;
            this.uiController.logMessage(`${group.muted ? 'Muted' : 'Unmuted'} group: ${group.name}`);
        }
    }
    
    // Toggle group solo
    toggleGroupSolo(groupId) {
        const group = this.clientGroups.get(groupId);
        if (group) {
            group.solo = !group.solo;
            
            // Update solo mode
            this.soloMode = Array.from(this.clientGroups.values()).some(g => g.solo);
            
            this.uiController.logMessage(`${group.solo ? 'Soloed' : 'Unsoloed'} group: ${group.name}`);
        }
    }
    
    // Get active clients (considering mute/solo states)
    getActiveClients() {
        if (this.clientGroups.size === 0) {
            return [...this.clients];
        }
        
        let activeClients = [];
        
        if (this.soloMode) {
            // Only include clients from soloed groups
            for (const group of this.clientGroups.values()) {
                if (group.solo) {
                    activeClients.push(...Array.from(group.clients));
                }
            }
        } else {
            // Include all clients except those in muted groups
            for (const group of this.clientGroups.values()) {
                if (!group.muted) {
                    activeClients.push(...Array.from(group.clients));
                }
            }
            // Include unassigned clients
            activeClients.push(...Array.from(this.unassignedClients));
        }
        
        return activeClients;
    }
    
    // Get all clients
    getClients() {
        return [...this.clients];
    }
    
    // Get client count
    getClientCount() {
        return this.clients.length;
    }
    
    // Get groups
    getGroups() {
        return Array.from(this.clientGroups.values());
    }
    
    // Get unassigned clients
    getUnassignedClients() {
        return Array.from(this.unassignedClients);
    }
    
    // Get client pitch settings
    getClientPitch(clientId) {
        return this.clientPitches.get(clientId);
    }
    
    // Set client pitch
    setClientPitch(clientId, frequency) {
        this.clientPitches.set(clientId, {
            frequency: frequency,
            note: this.frequencyToNote(frequency)
        });
    }
}