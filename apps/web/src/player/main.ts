import { mount } from 'svelte';
import '../lib/theme.css';
import Player from './Player.svelte';

mount(Player, { target: document.getElementById('app')! });
