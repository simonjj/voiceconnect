const Mongoose = require('mongoose');
Mongoose.Promise = global.Promise;

const User = require('./User');

describe('User', () => {
    test('Model', async () => {
        const fakeUser = {
            nickname: 'My User',
            email: 'tester@touchto.io',
            code: 'Al8g4VKHA'
        };
        const user = new User(fakeUser);

        let error = user.validateSync();

        expect(user.get('id')).not.toBeNull();
        expect(user.get('code')).toBe(fakeUser.code);
        expect(error).toBeUndefined();
    });
});
