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
            clientsGrid: document.getElementById('clients-grid'),
            groupNameInput: document.getElementById('groupNameInput'),
            createGroupButton: document.getElementById('createGroupButton'),
            groupsContainer: document.getElementById('groups-container')
        };
        
        this.setupMessageHandlers();
        this.setupGroupEventHandlers();
    }
    
    // Set up WebSocket message handlers
    setupMessageHandlers() {
        // Use the client update callback instead of individual message handlers
        this.websocketController.onClientUpdate((clients) => {
            this.handleClientsUpdate(clients);
        });
        
        // Also listen for specific connection/disconnection events if needed
        this.websocketController.onMessage('clientConnected', (data) => {
            console.log('Client connected event:', data);
        });
        
        this.websocketController.onMessage('clientDisconnected', (data) => {
            console.log('Client disconnected event:', data);
        });
    }
    
    // Set up group UI event handlers
    setupGroupEventHandlers() {
        if (this.elements.createGroupButton) {
            this.elements.createGroupButton.addEventListener('click', () => {
                this.handleCreateGroup();
            });
        }
        
        if (this.elements.groupNameInput) {
            this.elements.groupNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleCreateGroup();
                }
            });
        }
    }
    
    // Handle create group button click
    handleCreateGroup() {
        const groupName = this.elements.groupNameInput?.value.trim();
        if (groupName) {
            const groupId = this.createGroup(groupName);
            this.elements.groupNameInput.value = '';
            this.updateGroupsUI();
        }
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
    handleClientsUpdate(clients) {
        // Clients is already an array from the websocket controller
        this.updateClientList(clients);
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
        
        // Convert client objects to IDs if needed
        this.clients = (newClients || []).map(client => {
            if (typeof client === 'string') {
                return client;
            } else if (client && client.id) {
                return client.id;
            } else {
                console.warn('Invalid client object:', client);
                return null;
            }
        }).filter(id => id !== null);
        
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
        
        // Update groups UI as well
        this.updateGroupsUI();
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
        const clientPitch = this.getClientPitch(clientId);
        const octaveOffset = clientPitch ? clientPitch.octaveOffset : 0;
        const semitoneOffset = clientPitch ? clientPitch.semitoneOffset : 0;
        
        const clientCard = document.createElement('div');
        clientCard.className = 'client-card';
        clientCard.innerHTML = `
            <div class="client-id">${shortId}</div>
            <p>Connected</p>
            
            <div class="pitch-controls" style="margin: 8px 0; padding: 8px; background-color: #f5f5f5; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <label style="font-size: 12px; min-width: 50px;">Octave:</label>
                    <input type="range" class="octave-offset" data-client="${clientId}" min="-2" max="2" value="${octaveOffset}" step="1" style="flex: 1;">
                    <span class="octave-value" style="font-size: 12px; min-width: 20px;">${octaveOffset > 0 ? '+' : ''}${octaveOffset}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 12px; min-width: 50px;">Fine:</label>
                    <input type="range" class="semitone-offset" data-client="${clientId}" min="-12" max="12" value="${semitoneOffset}" step="1" style="flex: 1;">
                    <span class="semitone-value" style="font-size: 12px; min-width: 20px;">${semitoneOffset > 0 ? '+' : ''}${semitoneOffset}</span>
                </div>
                <button class="button reset-pitch" data-client="${clientId}" style="font-size: 10px; padding: 2px 6px; margin-top: 4px;">Reset</button>
            </div>
            
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
        
        // Add event listeners to pitch controls
        const octaveSlider = clientCard.querySelector('.octave-offset');
        const octaveValue = clientCard.querySelector('.octave-value');
        const semitoneSlider = clientCard.querySelector('.semitone-offset');
        const semitoneValue = clientCard.querySelector('.semitone-value');
        const resetButton = clientCard.querySelector('.reset-pitch');
        
        octaveSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            octaveValue.textContent = (value > 0 ? '+' : '') + value;
            this.setClientPitch(clientId, value, parseInt(semitoneSlider.value));
        });
        
        semitoneSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            semitoneValue.textContent = (value > 0 ? '+' : '') + value;
            this.setClientPitch(clientId, parseInt(octaveSlider.value), value);
        });
        
        resetButton.addEventListener('click', () => {
            octaveSlider.value = 0;
            semitoneSlider.value = 0;
            octaveValue.textContent = '0';
            semitoneValue.textContent = '0';
            this.setClientPitch(clientId, 0, 0);
        });
        
        this.elements.clientsGrid.appendChild(clientCard);
    }
    
    // Update client count display
    updateClientCount() {
        const count = this.clients.length;
        
        // Update the UI controller's client count displays
        this.uiController.updateClientCount(count);
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
    setClientPitch(clientId, octaveOffset, semitoneOffset) {
        this.clientPitches.set(clientId, {
            octaveOffset: octaveOffset,
            semitoneOffset: semitoneOffset
        });
    }
    
    // Update groups UI
    updateGroupsUI() {
        if (!this.elements.groupsContainer) return;
        
        // Clear existing groups
        this.elements.groupsContainer.innerHTML = '';
        
        if (this.clientGroups.size === 0) {
            // Show placeholder
            this.elements.groupsContainer.innerHTML = `
                <div class="group-placeholder" style="text-align: center; color: #666; padding: 20px; border: 2px dashed #ccc; border-radius: 8px;">
                    No groups created yet. Create a group to organize your clients.
                </div>
            `;
            return;
        }
        
        // Add each group
        for (const group of this.clientGroups.values()) {
            this.addGroupElement(group);
        }
    }
    
    // Add group element to UI
    addGroupElement(group) {
        if (!this.elements.groupsContainer) return;
        
        const clientCount = group.clients.size;
        const unassignedClients = Array.from(this.unassignedClients);
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-card';
        groupDiv.style.cssText = `
            border: 1px solid #ddd; 
            border-radius: 8px; 
            padding: 15px; 
            margin-bottom: 15px; 
            background: ${group.muted ? '#ffeaea' : group.solo ? '#eaf7ff' : '#f9f9f9'};
        `;
        
        groupDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; color: ${group.muted ? '#d32f2f' : group.solo ? '#1976d2' : '#333'};">
                    ${group.name} (${clientCount} client${clientCount !== 1 ? 's' : ''})
                </h4>
                <div style="display: flex; gap: 8px;">
                    <button class="button group-mute-btn ${group.muted ? 'active' : ''}" 
                            data-group-id="${group.id}" style="padding: 4px 8px; font-size: 12px;">
                        ${group.muted ? 'Unmute' : 'Mute'}
                    </button>
                    <button class="button group-solo-btn ${group.solo ? 'active' : ''}" 
                            data-group-id="${group.id}" style="padding: 4px 8px; font-size: 12px;">
                        ${group.solo ? 'Unsolo' : 'Solo'}
                    </button>
                    <button class="button delete-group-btn" 
                            data-group-id="${group.id}" style="padding: 4px 8px; font-size: 12px; background-color: #f44336;">
                        Delete
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 10px;">
                <strong>Clients:</strong>
                <div class="group-clients" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px;">
                    ${Array.from(group.clients).map(clientId => 
                        `<span class="client-tag" style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                            ${clientId.substring(0, 8).toUpperCase()}
                        </span>`
                    ).join('')}
                    ${clientCount === 0 ? '<span style="color: #999; font-style: italic;">No clients assigned</span>' : ''}
                </div>
            </div>
            
            ${unassignedClients.length > 0 ? `
                <div style="margin-top: 10px;">
                    <label style="font-size: 12px; font-weight: bold;">Add client to group:</label>
                    <div style="display: flex; gap: 8px; margin-top: 5px;">
                        <select class="add-client-select" data-group-id="${group.id}" style="flex: 1; font-size: 12px;">
                            <option value="">Select a client...</option>
                            ${unassignedClients.map(clientId => 
                                `<option value="${clientId}">${clientId.substring(0, 8).toUpperCase()}</option>`
                            ).join('')}
                        </select>
                        <button class="button add-client-btn" data-group-id="${group.id}" style="padding: 4px 8px; font-size: 12px;">Add</button>
                    </div>
                </div>
            ` : ''}
        `;
        
        // Add event listeners
        this.setupGroupCardEventListeners(groupDiv, group);
        
        this.elements.groupsContainer.appendChild(groupDiv);
    }
    
    // Setup group card event listeners
    setupGroupCardEventListeners(groupDiv, group) {
        // Mute button
        const muteBtn = groupDiv.querySelector('.group-mute-btn');
        muteBtn?.addEventListener('click', () => {
            this.toggleGroupMute(group.id);
            this.updateGroupsUI();
        });
        
        // Solo button
        const soloBtn = groupDiv.querySelector('.group-solo-btn');
        soloBtn?.addEventListener('click', () => {
            this.toggleGroupSolo(group.id);
            this.updateGroupsUI();
        });
        
        // Delete button
        const deleteBtn = groupDiv.querySelector('.delete-group-btn');
        deleteBtn?.addEventListener('click', () => {
            if (confirm(`Delete group "${group.name}"?`)) {
                this.deleteGroup(group.id);
                this.updateGroupsUI();
            }
        });
        
        // Add client functionality
        const addBtn = groupDiv.querySelector('.add-client-btn');
        const addSelect = groupDiv.querySelector('.add-client-select');
        
        addBtn?.addEventListener('click', () => {
            const clientId = addSelect?.value;
            if (clientId) {
                this.addClientToGroup(clientId, group.id);
                this.updateGroupsUI();
            }
        });
    }
}