import { fetchGrade } from './fetchGrade.js';

const fragment = document.createDocumentFragment();

const title = document.createElement('h1');
title.innerText = '高考成绩查询网站';

const grade = document.createElement('div');
grade.innerText = `Jerry 的高考成绩：${fetchGrade('Jerry')}`;

fragment.appendChild(title);
fragment.appendChild(grade);

document.getElementById('app').appendChild(fragment);
