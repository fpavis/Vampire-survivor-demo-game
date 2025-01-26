import { gameState } from './gameState.js';

export class InputManager {
    constructor(app, worldContainer) {
        this.app = app;
        this.worldContainer = worldContainer;
        this.keys = {};
        this.pointerPosition = null;
        this.pointerDown = false;
        this.bindEvents();
    }

    bindEvents() {
        // Keyboard events
        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);

        // Add pointer events for mouse/touch control
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;

        // Handle both mouse and touch
        this.app.stage.on('pointermove', (e) => {
            this.pointerPosition = { x: e.global.x, y: e.global.y };
        });

        this.app.stage.on('pointerdown', (e) => {
            this.pointerPosition = { x: e.global.x, y: e.global.y };
            this.pointerDown = true;
        });

        this.app.stage.on('pointerup', () => {
            this.pointerDown = false;
        });

        // Handle pointer leaving the game area
        this.app.stage.on('pointerleave', () => {
            this.pointerDown = false;
        });
    }

    handleWeaponSwitch(callback) {
        window.addEventListener('keydown', (e) => {
            const weaponKey = e.key;
            if (['1', '2', '3', '4'].includes(weaponKey)) {
                callback(parseInt(weaponKey));
            }
        });
    }

    getMovementDirection(delta, playerSpeed, joystick = null) {
        let dx = 0;
        let dy = 0;
        const speed = playerSpeed * delta;

        // Handle keyboard movement
        if (this.keys.ArrowLeft || this.keys.a || this.keys.A) dx -= 1;
        if (this.keys.ArrowRight || this.keys.d || this.keys.D) dx += 1;
        if (this.keys.ArrowUp || this.keys.w || this.keys.W) dy -= 1;
        if (this.keys.ArrowDown || this.keys.s || this.keys.S) dy += 1;

        // Handle joystick input if available
        if (joystick && joystick.active) {
            dx = joystick.position.x;
            dy = joystick.position.y;
        }
        // Only handle pointer/mouse if joystick is not active
        else if (this.pointerDown && this.pointerPosition && (!joystick || !joystick.visible)) {
            const worldX = this.pointerPosition.x - this.worldContainer.x;
            const worldY = this.pointerPosition.y - this.worldContainer.y;
            
            const dirX = worldX - gameState.player.x;
            const dirY = worldY - gameState.player.y;
            const distance = Math.sqrt(dirX * dirX + dirY * dirY);

            if (distance > 5) {
                dx = dirX / distance;
                dy = dirY / distance;
            }
        }

        // Normalize movement if using keyboard or mouse (not joystick)
        if ((dx !== 0 || dy !== 0) && (!joystick || !joystick.active)) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx = dx / length;
            dy = dy / length;
        }

        return {
            x: dx * speed,
            y: dy * speed
        };
    }
} 