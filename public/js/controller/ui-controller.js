// UI controller for Echo Mesh controller interface
export class UIController {
    constructor(websocketController) {
        this.websocketController = websocketController;
        this.currentSection = 'setup';
        this.elements = this.initializeElements();
        this.setupEventHandlers();
        this.setupNavigation();
    }
    
    // Initialize DOM elements
    initializeElements() {
        return {
            // Navigation
            navItems: document.querySelectorAll('.nav-item'),
            sections: document.querySelectorAll('.content-section'),
            
            // Status indicators
            serverStatus: document.getElementById('serverStatus'),
            serverIndicator: document.getElementById('serverIndicator'),
            clientCountStatus: document.getElementById('clientCountStatus'),
            clientIndicator: document.getElementById('clientIndicator'),
            syncStatus: document.getElementById('syncStatus'),
            syncIndicator: document.getElementById('syncIndicator'),
            
            // Setup section
            serverIp: document.getElementById('serverIp'),
            clientUrl: document.getElementById('clientUrl'),
            clientUrlDisplay: document.getElementById('clientUrlDisplay'),
            wsStatus: document.getElementById('wsStatus'),
            reconnectButton: document.getElementById('reconnectButton'),
            resyncButton: document.getElementById('resyncButton'),
            qrCode: document.getElementById('qrCode'),
            clientCount: document.getElementById('clientCount'),
            log: document.getElementById('log'),
            
            // Test section
            clientsGrid: document.getElementById('clients-grid'),
            testSoundButton: document.getElementById('testSoundButton'),
            refreshButton: document.getElementById('refreshButton'),
            soundType: document.getElementById('soundType'),
            delayTime: document.getElementById('delayTime'),
            playSequenceButton: document.getElementById('playSequenceButton'),
            playReverseButton: document.getElementById('playReverseButton'),
            playAllButton: document.getElementById('playAllButton'),
            
            // Compose section
            metronomeBpm: document.getElementById('metronomeBpm'),
            startMetronomeButton: document.getElementById('startMetronomeButton'),
            stopMetronomeButton: document.getElementById('stopMetronomeButton'),
            metronomeStatus: document.getElementById('metronomeStatus')
        };
    }
    
    // Set up event handlers
    setupEventHandlers() {
        // WebSocket events
        this.websocketController.onStatusChange((status, data) => {
            this.updateServerStatus(status, data);
        });
        
        this.websocketController.onClientUpdate((clients) => {
            // Just update navigation state - client manager handles the display
            this.updateNavigationState();
        });
        
        // Button event handlers
        this.setupButtonHandlers();
    }
    
    // Set up button event handlers
    setupButtonHandlers() {
        // Connection buttons
        this.elements.reconnectButton?.addEventListener('click', () => {
            this.handleReconnect();
        });
        
        this.elements.resyncButton?.addEventListener('click', () => {
            this.handleResync();
        });
        
        // Test buttons
        this.elements.testSoundButton?.addEventListener('click', () => {
            this.handleTestSound();
        });
        
        this.elements.refreshButton?.addEventListener('click', () => {
            this.handleRefreshClients();
        });
        
        this.elements.playSequenceButton?.addEventListener('click', () => {
            this.handlePlaySequence();
        });
        
        this.elements.playReverseButton?.addEventListener('click', () => {
            this.handlePlayReverse();
        });
        
        this.elements.playAllButton?.addEventListener('click', () => {
            this.handlePlayAll();
        });
        
        // Metronome buttons
        this.elements.startMetronomeButton?.addEventListener('click', () => {
            this.handleStartMetronome();
        });
        
        this.elements.stopMetronomeButton?.addEventListener('click', () => {
            this.handleStopMetronome();
        });
    }
    
    // Set up navigation
    setupNavigation() {
        this.elements.navItems.forEach(navItem => {
            navItem.addEventListener('click', (e) => {
                if (navItem.classList.contains('disabled')) return;
                
                const sectionName = navItem.dataset.section;
                this.switchSection(sectionName);
            });
        });
    }
    
    // Switch to a different section
    switchSection(sectionName) {
        // Update navigation
        this.elements.navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === sectionName) {
                item.classList.add('active');
            }
        });
        
        // Update sections
        this.elements.sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === `${sectionName}-section`) {
                section.classList.add('active');
            }
        });
        
        this.currentSection = sectionName;
        
        // Initialize spatial controller when entering spatial section
        if (sectionName === 'spatial' && window.spatialController) {
            setTimeout(() => {
                window.spatialController.initialize();
            }, 100); // Small delay to ensure DOM is ready
        }
        
        // Enable navigation items based on connection status
        this.updateNavigationState();
    }
    
    // Update navigation state - all tabs are now always enabled
    updateNavigationState() {
        // Remove disabled class from all navigation items to allow free navigation
        this.elements.navItems.forEach(item => {
            item.classList.remove('disabled');
        });
    }
    
    // Update server status display
    updateServerStatus(status, data) {
        const statusMap = {
            'connected': { text: 'Connected', class: 'status-ready' },
            'disconnected': { text: 'Disconnected', class: 'status-error' },
            'connecting': { text: 'Connecting', class: 'status-warning' },
            'error': { text: 'Error', class: 'status-error' }
        };
        
        const statusInfo = statusMap[status] || statusMap['error'];
        
        if (this.elements.serverStatus) {
            this.elements.serverStatus.textContent = statusInfo.text;
        }
        
        if (this.elements.serverIndicator) {
            this.elements.serverIndicator.className = `status-indicator ${statusInfo.class}`;
        }
        
        if (this.elements.wsStatus) {
            this.elements.wsStatus.textContent = statusInfo.text;
        }
        
        // Update client count
        const clientCount = data?.clientCount || 0;
        if (this.elements.clientCountStatus) {
            this.elements.clientCountStatus.textContent = clientCount.toString();
        }
        
        if (this.elements.clientCount) {
            this.elements.clientCount.textContent = clientCount.toString();
        }
        
        // Update client indicator
        if (this.elements.clientIndicator) {
            const clientClass = clientCount > 0 ? 'status-ready' : 'status-error';
            this.elements.clientIndicator.className = `status-indicator ${clientClass}`;
        }
        
        // Update sync status
        if (this.elements.syncStatus) {
            this.elements.syncStatus.textContent = status === 'connected' ? 'Yes' : 'No';
        }
        
        if (this.elements.syncIndicator) {
            const syncClass = status === 'connected' ? 'status-ready' : 'status-error';
            this.elements.syncIndicator.className = `status-indicator ${syncClass}`;
        }
        
        this.updateNavigationState();
    }
    
    // Update clients count display
    updateClientCount(count) {
        if (this.elements.clientCount) {
            this.elements.clientCount.textContent = count.toString();
        }
        if (this.elements.clientCountStatus) {
            this.elements.clientCountStatus.textContent = count.toString();
        }
    }
    
    // Create client card element
    createClientCard(client) {
        const card = document.createElement('div');
        card.className = 'client-card';
        card.dataset.clientId = client.id;
        
        const shortId = client.id.substring(0, 8).toUpperCase();
        
        card.innerHTML = `
            <div class="client-id">${shortId}</div>
            <p>Connected: ${new Date(client.connectedAt || Date.now()).toLocaleTimeString()}</p>
            <button class="button sound" onclick="window.controllerApp?.testClientSound('${client.id}')">
                Test Sound
            </button>
        `;
        
        return card;
    }
    
    // Handle reconnect button
    handleReconnect() {
        this.logMessage('Reconnecting to server...');
        this.websocketController.reconnect();
    }
    
    // Handle resync button
    handleResync() {
        this.logMessage('Requesting server sync...');
        this.websocketController.requestClientSync();
    }
    
    // Handle test sound button
    handleTestSound() {
        // This would typically play a local test sound
        this.logMessage('Local test sound played');
    }
    
    // Handle refresh clients button
    handleRefreshClients() {
        this.logMessage('Refreshing client list...');
        if (this.websocketController.isConnected) {
            this.websocketController.requestClientList();
        } else {
            this.logMessage('Not connected to server');
        }
    }
    
    // Handle play sequence button
    handlePlaySequence() {
        const soundType = this.elements.soundType?.value || 'sine';
        const delay = parseInt(this.elements.delayTime?.value) || 500;
        const clients = this.websocketController.getClients();
        
        if (clients.length === 0) {
            this.logMessage('No clients connected');
            return;
        }
        
        const clientIds = clients.map(c => c.id);
        this.websocketController.playSequence(clientIds, soundType, delay);
        this.logMessage(`Playing ${soundType} sequence with ${delay}ms delay`);
    }
    
    // Handle play reverse button
    handlePlayReverse() {
        const soundType = this.elements.soundType?.value || 'sine';
        const delay = parseInt(this.elements.delayTime?.value) || 500;
        const clients = this.websocketController.getClients();
        
        if (clients.length === 0) {
            this.logMessage('No clients connected');
            return;
        }
        
        const clientIds = clients.map(c => c.id);
        this.websocketController.playReverseSequence(clientIds, soundType, delay);
        this.logMessage(`Playing reverse ${soundType} sequence with ${delay}ms delay`);
    }
    
    // Handle play all button
    handlePlayAll() {
        const soundType = this.elements.soundType?.value || 'sine';
        this.websocketController.triggerSoundAll(soundType);
        this.logMessage(`Playing ${soundType} on all clients`);
    }
    
    // Handle start metronome button
    handleStartMetronome() {
        const bpm = parseInt(this.elements.metronomeBpm?.value) || 120;
        this.websocketController.startMetronome(bpm);
        this.logMessage(`Starting metronome at ${bpm} BPM`);
        
        if (this.elements.startMetronomeButton) {
            this.elements.startMetronomeButton.style.display = 'none';
        }
        if (this.elements.stopMetronomeButton) {
            this.elements.stopMetronomeButton.style.display = 'inline-block';
        }
        if (this.elements.metronomeStatus) {
            this.elements.metronomeStatus.textContent = `Running at ${bpm} BPM`;
        }
    }
    
    // Handle stop metronome button
    handleStopMetronome() {
        this.websocketController.stopMetronome();
        this.logMessage('Stopping metronome');
        
        if (this.elements.startMetronomeButton) {
            this.elements.startMetronomeButton.style.display = 'inline-block';
        }
        if (this.elements.stopMetronomeButton) {
            this.elements.stopMetronomeButton.style.display = 'none';
        }
        if (this.elements.metronomeStatus) {
            this.elements.metronomeStatus.textContent = 'Stopped';
        }
    }
    
    // Test specific client sound
    testClientSound(clientId) {
        const soundType = this.elements.soundType?.value || 'sine';
        this.websocketController.triggerSound([clientId], soundType);
        
        const shortId = clientId.substring(0, 8).toUpperCase();
        this.logMessage(`Testing ${soundType} sound on client ${shortId}`);
    }
    
    // Initialize connection info
    async initializeConnectionInfo() {
        try {
            // First, try to get network info from the server
            const response = await fetch('/api/network-info');
            const networkInfo = await response.json();
            
            let clientUrl, serverIp;
            
            if (networkInfo.addresses && networkInfo.addresses.length > 0) {
                // Use the first available network address (usually the LAN IP)
                const primaryAddress = networkInfo.addresses[0];
                clientUrl = primaryAddress.clientUrl;
                serverIp = primaryAddress.address + ':' + networkInfo.port;
                
                console.log('Using network IP:', primaryAddress.address);
                this.logMessage(`Network IP detected: ${primaryAddress.address}`);
            } else {
                // Fallback to localhost if network info isn't available
                const protocol = window.location.protocol;
                const host = window.location.host;
                clientUrl = `${protocol}//${host}/client.html`;
                serverIp = host;
                
                console.log('Falling back to localhost');
                this.logMessage('Using localhost (network IP detection failed)');
            }
            
            if (this.elements.serverIp) {
                this.elements.serverIp.textContent = serverIp;
            }
            
            if (this.elements.clientUrl) {
                this.elements.clientUrl.textContent = clientUrl;
            }
            
            if (this.elements.clientUrlDisplay) {
                this.elements.clientUrlDisplay.textContent = clientUrl;
            }
            
            // Generate QR code if canvas element exists
            if (this.elements.qrCode && typeof QRious !== 'undefined') {
                try {
                    const qr = new QRious({
                        element: this.elements.qrCode,
                        value: clientUrl,
                        size: 200
                    });
                    console.log('QR code generated successfully for URL:', clientUrl);
                    this.logMessage(`QR code generated for: ${clientUrl}`);
                } catch (error) {
                    console.warn('QR code generation failed:', error);
                    // Fallback: display URL as text in canvas
                    const ctx = this.elements.qrCode.getContext('2d');
                    ctx.fillStyle = '#333';
                    ctx.font = '12px Arial';
                    ctx.fillText('QR Code failed to generate', 10, 30);
                    ctx.fillText(clientUrl, 10, 50);
                }
            } else {
                console.warn('QRious library not loaded or qrCode element not found');
            }
            
        } catch (error) {
            console.error('Failed to get network info:', error);
            this.logMessage('Network detection failed, using localhost');
            
            // Fallback to localhost
            const protocol = window.location.protocol;
            const host = window.location.host;
            const clientUrl = `${protocol}//${host}/client.html`;
            
            if (this.elements.serverIp) {
                this.elements.serverIp.textContent = host;
            }
            
            if (this.elements.clientUrl) {
                this.elements.clientUrl.textContent = clientUrl;
            }
            
            if (this.elements.clientUrlDisplay) {
                this.elements.clientUrlDisplay.textContent = clientUrl;
            }
            
            // Still try to generate QR code with localhost URL
            if (this.elements.qrCode && typeof QRious !== 'undefined') {
                try {
                    const qr = new QRious({
                        element: this.elements.qrCode,
                        value: clientUrl,
                        size: 200
                    });
                } catch (error) {
                    console.warn('QR code generation failed:', error);
                }
            }
        }
    }
    
    // Add log message
    logMessage(message) {
        console.log('LOG:', message);
        
        if (!this.elements.log) {
            console.warn('Log element not found!');
            return;
        }
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        entry.style.padding = '2px 0';
        entry.style.fontSize = '12px';
        entry.style.color = '#333';
        
        this.elements.log.appendChild(entry);
        this.elements.log.scrollTop = this.elements.log.scrollHeight;
        
        // Keep only last 50 entries
        while (this.elements.log.children.length > 50) {
            this.elements.log.removeChild(this.elements.log.firstChild);
        }
    }
    
    // Get current section
    getCurrentSection() {
        return this.currentSection;
    }
    
    // Initialize the UI
    async initialize() {
        await this.initializeConnectionInfo();
        this.switchSection('setup');
        this.logMessage('Controller UI initialized');
    }
}