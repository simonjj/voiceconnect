class MockRes {
    json(v) {
        return this.send(v);
    }

    send(v) {
        this.sent = v;
        return this;
    }

    end(v) {
        this.end = v;
        return this;
    }

    set(valuesObject) {
        Object.entries(valuesObject).forEach(([k, v]) => (this[k] = v));
        return this;
    }

    status(code) {
        this.sentStatus = code;
        return this;
    }
}

module.exports = MockRes;
