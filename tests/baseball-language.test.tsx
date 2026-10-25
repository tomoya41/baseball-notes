import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatThrowBat} from '../src/presentation/baseball-language';
import {NpbPlayerProfileFacts} from '../src/ui/npb-player-profile';
import {NpbProfileDetails} from '../src/ui/npb-product';
import type {NpbCatalog} from '../src/domain/npb-product-contract';
import type {NpbDirectoryPlayer} from '../src/domain/npb-player-directory';
it.each([['right','right','右投右打'],['right','left','右投左打'],['left','left','左投左打'],['right','switch','右投両打'],['left','right','左投右打'],['R','L','右投左打'],['R','B','右投両打'],['右','左','右投左打']])('formats throws %s then bats %s', (throws,bats,text)=>{expect(formatThrowBat(throws,bats)).toBe(text);});
it('does not guess either hand, leak unknown source values, or swap them',()=>{
 expect(formatThrowBat(null,'left')).toBe('投げる手未確認・左打');expect(formatThrowBat('right',null)).toBe('右投・打席未確認');expect(formatThrowBat('X','未確認')).toBe('投打未確認');expect(formatThrowBat(undefined,undefined)).toBe('投打未確認');
});
it('uses the same label/order in directory and catalog profiles without changing raw fields',()=>{
 const source={throws:'right',bats:'left'};
 const directory=renderToStaticMarkup(<NpbPlayerProfileFacts player={source as NpbDirectoryPlayer}/>);
 const catalog=renderToStaticMarkup(<NpbProfileDetails player={{profile:{...source,ageYears:null,heightCm:null,weightKg:null},membership:{uniformNumber:null},visual:{photo:{usage:'unavailable'}}} as NpbCatalog['players'][number]}/>);
 expect(directory).toContain('投打 右投左打');expect(catalog).toContain('<dt>投打</dt><dd>右投左打</dd>');expect(catalog).not.toContain('<dt>打席</dt>');expect(source).toEqual({throws:'right',bats:'left'});
});
