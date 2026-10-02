import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { filterClassDiagram } from '../src/core/classDiagramDetail';

describe('classDiagramDetail filter (+/- rule)', () => {
    const blockCode = `classDiagram
class BankAccount {
  owner: String
  +deposit(amount)
  -reset()
  balance: Int
}`;

    test('full returns code unchanged', () => {
        assert.strictEqual(filterClassDiagram(blockCode, 'full'), blockCode);
    });

    test('minimal collapses emptied blocks to bare class declarations', () => {
        const code = `classDiagram
class BankAccount {
  owner: String
  +deposit(amount)
}`;
        const out = filterClassDiagram(code, 'minimal');
        assert.ok(!out.includes('{'), 'no braces left');
        assert.ok(!out.includes('}'), 'no braces left');
        assert.ok(out.includes('class BankAccount'), 'keeps bare declaration');
    });

    test('minimal keeps annotations but still collapses member-less blocks', () => {
        const code = `classDiagram
class Duck {
  <<interface>>
  +swim()
}`;
        const out = filterClassDiagram(code, 'minimal');
        assert.ok(out.includes('<<interface>>'), 'keeps annotation');
        assert.ok(!out.includes('swim'), 'removes method');
    });

    test('compact strips blank lines inside blocks', () => {
        const code = `classDiagram
class BankAccount {
  owner: String

  +deposit(amount)

  balance: Int
}`;
        const out = filterClassDiagram(code, 'compact');
        const inside = out.slice(out.indexOf('{') + 1, out.indexOf('}'));
        assert.ok(!inside.includes('\n\n'), 'no blank lines inside block');
        assert.ok(out.includes('owner: String'), 'keeps property');
    });

    test('minimal strips all members but keeps class shell and relations', () => {
        const code = `classDiagram
class BankAccount {
  owner: String
  +deposit(amount)
}
BankAccount --|> Account
Customer --> BankAccount`;
        const out = filterClassDiagram(code, 'minimal');
        assert.ok(out.includes('class BankAccount'), 'keeps class declaration');
        assert.ok(out.includes('BankAccount --|> Account'), 'keeps relations');
        assert.ok(!out.includes('owner'), 'removes property');
        assert.ok(!out.includes('deposit'), 'removes method');
    });

    test('compact keeps properties, removes +/- members', () => {
        const out = filterClassDiagram(blockCode, 'compact');
        assert.ok(out.includes('owner: String'), 'keeps property');
        assert.ok(out.includes('balance: Int'), 'keeps property');
        assert.ok(!out.includes('deposit'), 'removes + method');
        assert.ok(!out.includes('reset'), 'removes - method');
    });

    test('colon syntax: compact keeps bare members, removes +/- members', () => {
        const code = `classDiagram
BankAccount : owner
BankAccount : +deposit(amount)
BankAccount : -reset()
BankAccount : balance`;
        const out = filterClassDiagram(code, 'compact');
        assert.ok(out.includes('BankAccount : owner'), 'keeps property');
        assert.ok(out.includes('BankAccount : balance'), 'keeps property');
        assert.ok(!out.includes('deposit'), 'removes + method');
        assert.ok(!out.includes('reset'), 'removes - method');
    });

    test('non-class diagrams pass through untouched', () => {
        const flow = `flowchart TD
    A --> B`;
        assert.strictEqual(filterClassDiagram(flow, 'minimal'), flow);
        assert.strictEqual(filterClassDiagram(flow, 'compact'), flow);
    });

    test('empty input returns empty', () => {
        assert.strictEqual(filterClassDiagram('', 'minimal'), '');
        assert.strictEqual(filterClassDiagram('   ', 'compact'), '   ');
    });
});
