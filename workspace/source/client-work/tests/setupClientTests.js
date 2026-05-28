import { unmountComponentAtNode } from 'react-dom';

let container = null;

beforeEach(() => {
    container = document.createElement('div');
    container.id = 'main';
    document.body.appendChild(container);
    global.container = container;
});

afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
    container = null;
    global.container = container;
});
