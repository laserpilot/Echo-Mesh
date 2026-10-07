import { mount } from 'svelte';
import '../lib/theme.css';
import Conduct from './Conduct.svelte';

mount(Conduct, { target: document.getElementById('app')! });
